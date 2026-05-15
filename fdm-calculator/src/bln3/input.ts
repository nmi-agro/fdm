import {
    getCultivations,
    getField,
    getMeasures,
    getSoilAnalyses,
} from "@nmi-agro/fdm-core"
import type {
    FdmType,
    fdmSchema,
    PrincipalId,
    Timeframe,
} from "@nmi-agro/fdm-core"
import type {
    Bln3Cultivation,
    Bln3Measure,
    Bln3ScoreCollectedInputs,
} from "./types"

/**
 * Collects all field data needed for a BLN3 score calculation from the FDM database.
 *
 * Fetches field geometry (lat/lon), the most recent soil analysis, cultivations, and
 * adopted BLN measures for the field, then maps them to the shape expected by the
 * NMI BLN3 API. The caller is responsible for adding `nmiApiKey` before calling
 * `getBln3Score`.
 *
 * @param fdm - The FDM instance for database interaction.
 * @param principal_id - The principal making the request.
 * @param b_id - The field ID for which to collect inputs.
 * @param timeframe - Optional timeframe to filter cultivations and measures.
 * @returns A promise resolving to the collected BLN3 score inputs (without `nmiApiKey`).
 * @throws {Error} If data collection fails.
 */
export async function collectInputForBln3Score(
    fdm: FdmType,
    principal_id: PrincipalId,
    b_id: fdmSchema.fieldsTypeSelect["b_id"],
    timeframe?: Timeframe,
): Promise<Bln3ScoreCollectedInputs> {
    try {
        const [field, soilAnalyses, cultivations, measures] = await Promise.all(
            [
                getField(fdm, principal_id, b_id),
                getSoilAnalyses(fdm, principal_id, b_id, timeframe),
                getCultivations(fdm, principal_id, b_id, timeframe),
                getMeasures(fdm, principal_id, b_id, timeframe),
            ],
        )

        // b_centroid = [lon, lat] (ST_X = longitude, ST_Y = latitude)
        const [a_lon, a_lat] = field.b_centroid

        // Pick non-null numeric a_* fields from the most recent soil analysis
        const latestAnalysis = soilAnalyses[0]
        const soilData: Record<string, number> = {}
        if (latestAnalysis) {
            for (const [key, value] of Object.entries(latestAnalysis)) {
                if (key.startsWith("a_") && typeof value === "number") {
                    soilData[key] = value
                }
            }
        }

        // Map cultivations: "nl_266" → { b_lu_brp: 266, b_lu_year: 2025 }
        const fallbackYear = timeframe?.end?.getFullYear()
        const bln3Cultivations: Bln3Cultivation[] = cultivations
            .map((c) => {
                const match = /^nl_(\d+)$/.exec(c.b_lu_catalogue)
                if (!match) return null
                const year = c.b_lu_start?.getFullYear() ?? fallbackYear
                if (year === undefined) return null
                return { b_lu_brp: Number(match[1]), b_lu_year: year }
            })
            .filter((c): c is Bln3Cultivation => c !== null)

        // Map measures: "bln_BM3" → { measure_id: "BM3", year: 2025 }
        const bln3Measures: Bln3Measure[] = measures
            .filter((m) => m.m_id.startsWith("bln_"))
            .map((m) => {
                const year = m.m_start?.getFullYear() ?? fallbackYear
                if (year === undefined) return null
                return {
                    measure_id: m.m_id.replace(/^bln_/, ""),
                    year,
                }
            })
            .filter((m): m is Bln3Measure => m !== null)

        return {
            a_lat,
            a_lon,
            b_soiltype_agr: latestAnalysis?.b_soiltype_agr as Bln3ScoreCollectedInputs["b_soiltype_agr"],
            b_gwl_class: latestAnalysis?.b_gwl_class as Bln3ScoreCollectedInputs["b_gwl_class"],
            ...(bln3Cultivations.length > 0 && {
                cultivations: bln3Cultivations,
            }),
            ...(bln3Measures.length > 0 && { measures: bln3Measures }),
            ...soilData,
        }
    } catch (error) {
        throw new Error(
            `Failed to collect BLN3 score inputs for field ${b_id}: ${error instanceof Error ? error.message : String(error)}`,
            { cause: error },
        )
    }
}
