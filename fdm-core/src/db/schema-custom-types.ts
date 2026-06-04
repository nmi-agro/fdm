import { sql } from "drizzle-orm"
import { type CustomTypeValues, customType } from "drizzle-orm/pg-core"
import type * as GeoJSON from "geojson"

// Workaround for that `numeric` column type returns string instead of a number
// https://github.com/drizzle-team/drizzle-orm/issues/1042#issuecomment-2224689025
type NumericConfig = {
    precision?: number
    scale?: number
}

export const numericCasted = customType<{
    data: number
    driverData: string
    config: NumericConfig
}>({
    dataType: (config) => {
        if (config?.precision && config?.scale) {
            return `numeric(${config.precision}, ${config.scale})`
        }
        return "numeric"
    },
    fromDriver: (value: string) => Number.parseFloat(value),
    toDriver: (value: number) => value.toString(),
})

/**
 * Experimental custom type for PostGIS geometry, only supports reads
 * Originally from https://gist.github.com/ItsWendell/38ebe96b34d00d9138ce23cc363d7009
 */
export const geometry = <
    TType extends keyof GeometryTypes = keyof GeometryTypes,
    T extends CustomTypeValues = CustomTypeValues,
>(
    dbName: string,
    fieldConfig?: T["config"] & { type?: TType | readonly TType[] },
) => {
    const type = fieldConfig?.type
    return customType<{
        data: GeometryTypes[TType]
    }>({
        dataType() {
            return typeof type === "string" ? `geometry(${type},4326)` : "geometry"
        },
        toDriver(value) {
            return sql`ST_GeomFromGeoJSON(${JSON.stringify(value)})`
        },
        fromDriver(value) {
            const val = value as string

            // Detect if hex string
            if (!val.startsWith("{")) {
                return parseHexToGeometry(val) as GeometryTypes[TType]
            }
            try {
                const data = JSON.parse(value as string)

                if (typeof type === "string" && data.type !== type) {
                    throw new Error(
                        `Expected geometry type ${type}, got ${data.type}`,
                    )
                }

                if (
                    Array.isArray(type) &&
                    !type.includes(data.type as TType)
                ) {
                    throw new Error(
                        `Expected geometry type ${type.join(", ")}, got ${data.type}`,
                    )
                }

                return data as GeometryTypes[TType]
            } catch (e) {
                throw new Error(`Failed to parse geometry: ${value}`, {
                    cause: e,
                })
            }
        },
    })(dbName, fieldConfig)
}

export enum GeometryType {
    Point = 1,
    LineString = 2,
    Polygon = 3,
    MultiPoint = 4,
    MultiLineString = 5,
    MultiPolygon = 6,
    GeometryCollection = 7,
}

export const parseHexToGeometry = (hex: string): GeoJSON.Geometry => {
    try {
        const byteStr = hex
            .match(/.{1,2}/g)
            ?.map((byte) => Number.parseInt(byte, 16))
        if (!byteStr) {
            throw new Error("Failed to convert hex to buffer")
        }

        const uint8Array = new Uint8Array(byteStr)
        const buffer = uint8Array.buffer

        const dataView = new DataView(buffer)

        let byteOffset = 0

        const byteOrder = dataView.getUint8(0) // 1 byte
        byteOffset += 1 // Move the byte offset past the byte order field

        const littleEndian = byteOrder === 1

        let geometryType = dataView.getUint32(1, littleEndian) // 4 bytes
        byteOffset += 4 // Move the byte offset past the geometry type field

        const hasSRID = (geometryType & 0x20000000) > 0 // Check if the SRID flag is set

        if (hasSRID) {
            // If SRID is included, read the SRID
            // _srid = dataView.getUint32(byteOffset, littleEndian)
            // Set geometry type to the actual type, stripping the SRID flag
            geometryType &= ~0x20000000
            byteOffset += 4 // Move the byte offset past the SRID field
        }

        const geometry = parseGeometry(
            dataView,
            littleEndian,
            geometryType,
            byteOffset,
        )

        return geometry
    } catch (e) {
        throw new Error(`Failed to parse hex geometry: ${hex}`, { cause: e })
    }
}

function readPoint(
    dataView: DataView,
    littleEndian: boolean,
    offset: number,
): GeoJSON.Position {
    if (offset + 16 > dataView.byteLength) {
        throw new Error("Buffer too small to read Point coordinates")
    }
    const x = dataView.getFloat64(offset, littleEndian)
    const y = dataView.getFloat64(offset + 8, littleEndian)
    return [x, y]
}

function readMultiPoint(
    dataView: DataView,
    littleEndian: boolean,
    offset: number,
): GeoJSON.Position[] {
    if (offset + 4 > dataView.byteLength) {
        throw new Error("Buffer too small to read MultiPoint")
    }
    const numPoints = dataView.getUint32(offset, littleEndian)
    offset += 4
    const points: GeoJSON.Position[] = []
    for (let i = 0; i < numPoints; i++) {
        points.push(readPoint(dataView, littleEndian, offset + i * 16))
    }
    return points
}

// function readLineString(
//     dataView: DataView,
//     littleEndian: boolean,
//     offset: number,
// ): GeoJSON.Position[] {
//     const numPoints = dataView.getUint32(offset, littleEndian)
//     offset += 4
//     const points: GeoJSON.Position[] = []

//     for (let i = 0; i < numPoints; i++) {
//         const x = dataView.getFloat64(offset, littleEndian)
//         const y = dataView.getFloat64(offset + 8, littleEndian)
//         points.push([x, y])
//         offset += 16
//     }
//     return points
// }

function readPolygon(
    dataView: DataView,
    littleEndian: boolean,
    offset: number,
): GeoJSON.Position[][] {
    const numRings = dataView.getUint32(offset, littleEndian)
    offset += 4
    const rings: GeoJSON.Position[][] = []
    for (let i = 0; i < numRings; i++) {
        const numPoints = dataView.getUint32(offset, littleEndian)
        offset += 4
        const points: GeoJSON.Position[] = []
        for (let j = 0; j < numPoints; j++) {
            const x = dataView.getFloat64(offset, littleEndian)
            const y = dataView.getFloat64(offset + 8, littleEndian)
            points.push([x, y])
            offset += 16
        }
        rings.push(points)
    }
    return rings
}

// function readMultiLineString(
//     dataView: DataView,
//     littleEndian: boolean,
//     offset: number,
// ): GeoJSON.Position[][] {
//     const numLineStrings = dataView.getUint32(offset, littleEndian)
//     offset += 4
//     const lineStrings: GeoJSON.Position[][] = []

//     for (let i = 0; i < numLineStrings; i++) {
//         lineStrings.push(readLineString(dataView, littleEndian, offset))
//         offset += 4 + lineStrings[i].length * 16 // Advance offset based on the number of points in linestring
//     }

//     return lineStrings
// }

function readMultiPolygon(
    dataView: DataView,
    littleEndian: boolean,
    offset: number,
): GeoJSON.Position[][][] {
    if (offset + 4 > dataView.byteLength) {
        throw new Error("Buffer too small to read MultiPolygon")
    }
    const numPolygons = dataView.getUint32(offset, littleEndian)
    offset += 4
    const polygons: GeoJSON.Position[][][] = []

    for (let i = 0; i < numPolygons; i++) {
        if (offset + 5 > dataView.byteLength) {
            throw new Error("Buffer too small to read nested Polygon")
        }

        const polygonByteOrder = dataView.getUint8(offset)
        offset += 1
        const polygonLittleEndian = polygonByteOrder === 1

        let polygonType = dataView.getUint32(offset, polygonLittleEndian)
        offset += 4

        const hasSRID = (polygonType & 0x20000000) > 0
        if (hasSRID) {
            polygonType &= ~0x20000000
            offset += 4
        }

        if (polygonType !== GeometryType.Polygon) {
            throw new Error(
                `Expected nested Polygon, got geometry type ${polygonType}`,
            )
        }

        const polygon = readPolygon(dataView, polygonLittleEndian, offset)
        polygons.push(polygon)

        let polygonSize = 4
        for (const ring of polygon) {
            polygonSize += 4 + ring.length * 16
        }
        offset += polygonSize
    }

    return polygons
}

export const parseGeometry = (
    dataView: DataView,
    littleEndian: boolean,
    type: GeometryType,
    offset: number,
): GeoJSON.Geometry => {
    switch (type) {
        // case GeometryType.Point:
        //     return {
        //         type: "Point",
        //         coordinates: readPoint(
        //             dataView,
        //             littleEndian,
        //             offset,
        //         ) as GeoJSON.Point["coordinates"],
        //     }
        // case GeometryType.LineString:
        //     return {
        //         type: "LineString",
        //         coordinates: readLineString(
        //             dataView,
        //             littleEndian,
        //             offset,
        //         ) as GeoJSON.LineString["coordinates"],
        //     }
        case GeometryType.Polygon:
            return {
                type: "Polygon",
                coordinates: readPolygon(
                    dataView,
                    littleEndian,
                    offset,
                ) as GeoJSON.Polygon["coordinates"],
            }
        case GeometryType.MultiPoint:
            return {
                type: "MultiPoint",
                coordinates: readMultiPoint(
                    dataView,
                    littleEndian,
                    offset,
                ) as GeoJSON.MultiPoint["coordinates"],
            }
        // case GeometryType.MultiLineString:
        //     return {
        //         type: "MultiLineString",
        //         coordinates: readMultiLineString(
        //             dataView,
        //             littleEndian,
        //             offset,
        //         ) as GeoJSON.MultiLineString["coordinates"],
        //     }
        case GeometryType.MultiPolygon:
            return {
                type: "MultiPolygon",
                coordinates: readMultiPolygon(
                    dataView,
                    littleEndian,
                    offset,
                ) as GeoJSON.MultiPolygon["coordinates"],
            }
        // case GeometryType.GeometryCollection:
        //     throw new Error("GeometryCollection is not supported yet")
        default:
            throw new Error("Unsupported geometry type")
    }
}

export type GeometryTypes = {
    // Point: GeoJSON.Point
    // LineString: GeoJSON.LineString
    Polygon: GeoJSON.Polygon
    MultiPoint: GeoJSON.MultiPoint
    // MultiLineString: GeoJSON.MultiLineString
    MultiPolygon: GeoJSON.MultiPolygon
    // GeometryCollection: GeoJSON.GeometryCollection
}
