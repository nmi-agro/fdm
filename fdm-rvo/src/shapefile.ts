import { multiPolygon, polygon } from "@turf/helpers"
import type {
    Feature,
    FeatureCollection,
    Geometry,
    MultiPolygon,
    Polygon,
    Position,
} from "geojson"
import proj4 from "proj4"
import { combine, parseDbf, parseShp } from "shpjs"
import type { RvoField } from "./types"

interface RvoProperties {
    SECTORID: string
    SECTORVER: number
    NEN3610ID: string
    VOLGNR: number
    NAAM: string | null | undefined
    BEGINDAT: number
    EINDDAT: number
    GEWASCODE: string
    GEWASOMSCH: string
    TITEL: string
    TITELOMSCH: string
}

type FileInterface = Blob | ArrayBuffer

/**
 * Parses the files found in a MijnPercelen Shapefile export and compiles a GeoJSON feature collection where each feature's properties represent the field properties registered by RVO.
 * @param shp_file Shapefile or ArrayBuffer to parse
 * @param shx_file Shapefile index or ArrayBuffer  file to parse, the library might be able to optimize lookups in the shp file using this
 * @param prj_file Projection definition file or ArrayBuffer for coordinates found in the shp file, if not provided EPSG:4326 is assumed
 * @returns an array of geometries which can be passed to the shpjs combine function
 */
export async function parseShapefileGeometry(
    shp_file: FileInterface,
    shx_file: FileInterface | undefined,
    prj_file: Blob | string | undefined,
): Promise<(Polygon | MultiPolygon)[]> {
    try {
        const [shpData, shxData, projection] = await Promise.all([
            shp_file instanceof Blob ? shp_file.arrayBuffer() : shp_file,
            shx_file instanceof Blob ? shx_file.arrayBuffer() : shx_file,
            prj_file instanceof Blob ? prj_file.text() : prj_file,
        ])

        const geometries: Geometry[] = await parseShp(shpData, shxData)

        const projector = projection
            ? proj4(projection, "EPSG:4326")
            : undefined

        return geometries.map((geometry) => {
            const transformRing = (ring: Position[][]) =>
                projector
                    ? ring.map((coords) =>
                          coords.map((coord) => projector.forward(coord)),
                      )
                    : ring

            if (geometry.type === "MultiPolygon") {
                return multiPolygon(geometry.coordinates.map(transformRing))
                    .geometry
            }

            if (geometry.type === "Polygon") {
                return polygon(transformRing(geometry.coordinates)).geometry
            }

            throw new Error("Non-polygonal geometry encountered")
        })
    } catch (_error) {
        throw new Error("Shapefile is not valid", { cause: _error })
    }
}

/**
 * Parses the dbf file that is part of the MijnPercelen Shapefile export
 * @param dbf_file DBase file or ArrayBuffer to parse
 * @returns an array of objects representing the rows in the dbf file
 */
export async function parseShapefileAttributes(
    dbf_file: FileInterface,
): Promise<Partial<RvoProperties>[]> {
    try {
        return await parseDbf(
            dbf_file instanceof Blob ? await dbf_file.arrayBuffer() : dbf_file,
            undefined,
        )
    } catch (_error) {
        throw new Error("Shapefile is not valid", { cause: _error })
    }
}

/**
 * Converts a feature found in a Shapefile to a RvoField object to be used with the RVO import system
 *
 * `mestData` is not available in Shapefiles and will not be available in the result, thus no buffer strip information
 *
 * @param feature
 * @returns a RvoField object
 * @throws if any of the required properties are missing
 */
export function convertShapefileFeatureIntoRvoField(
    feature: Feature<Polygon, Partial<RvoProperties>>,
): RvoField {
    const isDefined = (x: unknown) => x !== null && typeof x !== "undefined"
    const { properties, geometry } = feature
    const {
        SECTORID,
        SECTORVER,
        NEN3610ID,
        VOLGNR,
        NAAM,
        BEGINDAT,
        EINDDAT,
        GEWASCODE,
        GEWASOMSCH,
        TITEL,
        TITELOMSCH,
    } = properties

    let beginDate: string | undefined
    let endDate: string | undefined
    try {
        if (isDefined(BEGINDAT)) {
            beginDate = new Date(BEGINDAT).toISOString()
        }
    } catch (_) {}
    try {
        // 253402297199 (the "null" date) can successfully be converted to a JS Date object
        // so just doing that is easier
        if (isDefined(EINDDAT)) {
            endDate = new Date(EINDDAT).toISOString()
        }
    } catch (_) {}

    if (
        !isDefined(SECTORID) ||
        !isDefined(SECTORVER) ||
        !isDefined(NEN3610ID) ||
        !isDefined(VOLGNR) ||
        NAAM === undefined || // null is accepted
        !isDefined(beginDate) ||
        !isDefined(endDate) ||
        !isDefined(GEWASCODE) ||
        !isDefined(GEWASOMSCH) ||
        !isDefined(TITEL) ||
        !isDefined(TITELOMSCH)
    ) {
        throw new Error("Field does not have the required attributes")
    }

    const trimmedNaam = typeof NAAM === "string" ? NAAM.trim() : ""

    return {
        type: "Feature",
        geometry: geometry,
        properties: {
            CropFieldID: SECTORID, // b_id_source
            CropFieldVersion: "1.0.0", // not needed
            CropFieldDesignator: trimmedNaam, // b_name
            BeginDate: beginDate, // b_start
            Country: "nl", // b_lu_catalogue[0]
            CropTypeCode: GEWASCODE, // b_lu_catalogue[1]
            UseTitleCode: TITEL, // b_acquiring_method
            ThirdPartyCropFieldID: undefined, // not needed
            EndDate: EINDDAT !== 253402297199 ? endDate : undefined, // b_end
            VarietyCode: undefined, // not needed
            CropProductionPurposeCode: undefined, // not needed
            FieldUseCode: undefined, // not needed
            RegulatorySoiltypeCode: undefined, // not needed
            CropFieldCause: undefined, // not needed
        },
    }
}

/**
 * Parses the files found in a MijnPercelen Shapefile export and compiles a GeoJSON feature collection where each feature's properties represent the field properties registered by RVO.
 *
 * `mestData` is not available in Shapefiles and will not be available in the result, thus no buffer strip information
 *
 * @param shp_file Shapefile or ArrayBuffer to parse
 * @param shx_file Shapefile index or ArrayBuffer  file to parse, the library might be able to optimize lookups in the shp file using this
 * @param dbf_file DBase file or ArrayBuffer to parse containing field properties registered by RVO
 * @param prj_file Projection definition file or ArrayBuffer for coordinates found in the shp file, if not provided EPSG:4326 is assumed
 * @returns List of RvoField objects
 */
export async function getRvoFieldsFromShapefile(
    shp_file: FileInterface,
    shx_file: FileInterface | undefined,
    dbf_file: FileInterface,
    prj_file: Blob | string | undefined,
): Promise<RvoField[]> {
    const geometries = await parseShapefileGeometry(
        shp_file,
        shx_file,
        prj_file,
    )
    const attributes = await parseShapefileAttributes(dbf_file)
    const shapefile: FeatureCollection<
        Polygon,
        Partial<RvoProperties>
    > = combine([geometries, attributes])

    if (shapefile.features.length === 0) {
        throw new Error("Shapefile does not contain any fields")
    }

    return shapefile.features.map(convertShapefileFeatureIntoRvoField)
}
