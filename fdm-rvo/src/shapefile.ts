import type {
    Feature,
    FeatureCollection,
    GeoJsonProperties,
    Geometry,
    Polygon,
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

export async function parseShapefileGeometry(
    shp_file: Blob,
    shx_file?: Blob,
): Promise<Geometry[]> {
    try {
        return parseShp(
            await shp_file.arrayBuffer(),
            await shx_file?.arrayBuffer(),
        )
    } catch (_error) {
        throw new Error("Shapefile is not valid", { cause: _error })
    }
}

export async function parseShapefileGeoJsonProperties(
    dbf_file: Blob,
): Promise<GeoJsonProperties[]> {
    try {
        return parseDbf(await dbf_file.arrayBuffer(), undefined)
    } catch (_error) {
        throw new Error("DBF file is not valid", { cause: _error })
    }
}

export async function getRvoFieldsFromShapefile(
    shp_file: Blob,
    shx_file: Blob,
    dbf_file: Blob,
    prj_file: Blob,
) {
    const prj_text = await prj_file.text()

    let shapefile: FeatureCollection<Polygon, RvoProperties>
    const shapefileGeometry = await parseShapefileGeometry(shp_file, shx_file)
    const shapefileGeoJsonProperties =
        await parseShapefileGeoJsonProperties(dbf_file)
    try {
        shapefile = combine([
            shapefileGeometry,
            shapefileGeoJsonProperties,
        ]) as FeatureCollection<Polygon, RvoProperties>
    } catch (_error) {
        throw new Error("Shapefile is not valid", { cause: _error })
    }

    if (shapefile.features.length === 0) {
        throw new Error("Shapefile does not contain any fields")
    }

    const source_proj = prj_text
    const dest_proj = "EPSG:4326"

    const converter =
        source_proj !== null ? proj4(source_proj, dest_proj) : null

    const features = shapefile.features.map(
        (feature: Feature<Polygon, RvoProperties>) => {
            const new_coords = feature.geometry.coordinates.map(
                (ring: number[][]) => {
                    return ring.map((coord: number[]) => {
                        return converter !== null
                            ? converter.forward(coord)
                            : coord
                    })
                },
            )
            feature.geometry.coordinates = new_coords
            return feature
        },
    )

    const fields: RvoField[] = []
    for (const feature of features) {
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

        if (
            !SECTORID ||
            !SECTORVER ||
            !NEN3610ID ||
            !VOLGNR ||
            NAAM === undefined ||
            !BEGINDAT ||
            !EINDDAT ||
            !GEWASCODE ||
            !GEWASOMSCH ||
            !TITEL ||
            !TITELOMSCH
        ) {
            throw new Error("Field does not have the required attributes")
        }

        const trimmedNaam = typeof NAAM === "string" ? NAAM.trim() : ""

        fields.push({
            type: "Feature",
            geometry: geometry,
            properties: {
                CropFieldID: SECTORID, // b_id_source
                CropFieldVersion: "1.0.0", // not needed
                CropFieldDesignator: trimmedNaam, // b_name
                BeginDate: new Date(BEGINDAT).toISOString(), // b_start
                Country: "nl", // b_lu_catalogue[0]
                CropTypeCode: GEWASCODE, // b_lu_catalogue[1]
                UseTitleCode: TITEL, // b_acquiring_method
                ThirdPartyCropFieldID: undefined, // not needed
                EndDate:
                    EINDDAT !== 253402297199
                        ? new Date(EINDDAT).toISOString()
                        : undefined, // b_end
                VarietyCode: undefined, // not needed
                CropProductionPurposeCode: undefined, // not needed
                FieldUseCode: undefined, // not needed
                RegulatorySoiltypeCode: undefined, // not needed
                CropFieldCause: undefined, // not needed
            },
        })
    }

    return fields
}
