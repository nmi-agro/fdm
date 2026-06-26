import {
    aggregateNormFillingsToFarmLevel,
    aggregateNormsToFarmLevel,
    calculateDose,
    calculateNitrogenBalanceField,
    calculateNitrogenBalancesFieldToFarm,
    calculateOrganicMatterBalanceField,
    collectInputForNitrogenBalance,
    collectInputForOrganicMatterBalance,
    createFunctionsForFertilizerApplicationFilling,
    getNutrientAdvice,
    type NormFilling,
    type NutrientAdvice,
} from "@nmi-agro/fdm-calculator"
import {
    type FertilizerApplication,
    getCurrentSoilData,
    getField,
    getFields,
    type PrincipalId,
} from "@nmi-agro/fdm-core"
import type { FieldMetrics } from "~/components/blocks/gerrit/types"
import { getFieldNormValues } from "~/integrations/calculator"
import { fdm } from "~/lib/fdm.server"

function isValidDutchCropCatalogue(b_lu_catalogue: string | undefined) {
    return /^nl_\d+$/.test(b_lu_catalogue ?? "")
}

/**
 * Attempts to repair truncated JSON by removing the last incomplete element
 * and closing any open arrays/objects. Returns null if repair is not possible.
 */
export function repairTruncatedJson(json: string): string | null {
    const lastCompleteObject = json.lastIndexOf("},")
    if (lastCompleteObject === -1) return null
    const trimmed = json.slice(0, lastCompleteObject + 1)
    let openBraces = 0
    let openBrackets = 0
    let inString = false
    let isEscaped = false
    for (const ch of trimmed) {
        if (isEscaped) {
            isEscaped = false
            continue
        }
        if (ch === "\\") {
            isEscaped = true
            continue
        }
        if (ch === '"') {
            inString = !inString
            continue
        }
        if (inString) continue
        if (ch === "{") openBraces++
        else if (ch === "}") openBraces--
        else if (ch === "[") openBrackets++
        else if (ch === "]") openBrackets--
    }
    let repaired = trimmed
    for (let i = 0; i < openBrackets; i++) repaired += "]"
    for (let i = 0; i < openBraces; i++) repaired += "}"
    try {
        JSON.parse(repaired)
        return repaired
    } catch {
        return null
    }
}

export async function computePlanMetrics(
    principalId: PrincipalId,
    b_id_farm: string,
    calendar: string,
    enrichedPlan: Array<{
        b_id: string
        b_lu_catalogue?: string
        b_area: number | null
        b_bufferstrip: boolean
        applications: Array<{
            p_id_catalogue: string
            p_app_amount: number
            p_app_date: string
            p_app_method?: string | null
        }>
        fieldMetrics: FieldMetrics | null
    }>,
    fertilizers: any[],
    nmiApiKey?: string,
) {
    if (!["2025", "2026"].includes(calendar)) {
        console.warn(
            `[computePlanMetrics] Unsupported calendar value "${calendar}"; falling back to "2025".`,
        )
    }
    const year = (["2025", "2026"].includes(calendar) ? calendar : "2025") as
        | "2025"
        | "2026"
    const fillingFuncs = createFunctionsForFertilizerApplicationFilling(
        "NL",
        year,
    )
    const fieldMetricsMap: Record<string, FieldMetrics> = {}

    const timeframe = {
        start: new Date(`${calendar}-01-01`),
        end: new Date(`${calendar}-12-31`),
    }

    const [omInput, nInput] = await Promise.all([
        collectInputForOrganicMatterBalance(
            fdm,
            principalId,
            b_id_farm,
            timeframe,
        ).catch(() => null),
        collectInputForNitrogenBalance(
            fdm,
            principalId,
            b_id_farm,
            timeframe,
        ).catch(() => null),
    ])

    const fieldResults = await Promise.allSettled(
        enrichedPlan
            .filter((f) => f.b_area)
            .map(async (field) => {
                let manure:
                    | { normValue: number; normSource: string }
                    | undefined
                let nitrogen:
                    | { normValue: number; normSource: string }
                    | undefined
                let phosphate:
                    | { normValue: number; normSource: string }
                    | undefined
                try {
                    const norms = await getFieldNormValues({
                        fdm,
                        principal_id: principalId,
                        b_id: field.b_id,
                        calendar: year,
                    })
                    if (norms.manure && norms.phosphate && norms.nitrogen) {
                        manure = norms.manure
                        phosphate = norms.phosphate
                        nitrogen = norms.nitrogen
                    } else {
                        throw new Error("Missing norms")
                    }
                } catch (err) {
                    console.warn(
                        `[computePlanMetrics] Norm calc failed for ${field.b_id}:`,
                        err,
                    )
                    throw err
                }

                const syntheticApps: FertilizerApplication[] =
                    field.applications.map((app, i) => {
                        const sanitizedCatalogueId = app.p_id_catalogue.replace(
                            /[^\x00-\x7F]/g,
                            "",
                        )
                        const fert = fertilizers.find(
                            (f) => f.p_id_catalogue === sanitizedCatalogueId,
                        )
                        return {
                            p_id: fert?.p_id ?? sanitizedCatalogueId,
                            p_id_catalogue: sanitizedCatalogueId,
                            p_name_nl: fert?.p_name_nl ?? null,
                            p_app_amount: app.p_app_amount,
                            p_app_date: new Date(app.p_app_date),
                            p_app_id: `plan-${field.b_id}-${i}`,
                            p_app_method: app.p_app_method ?? null,
                            p_source: "fdm" as const,
                            p_source_id: null,
                            b_id: field.b_id,
                            b_calendar: year,
                        } as unknown as FertilizerApplication
                    })

                let manureFilling: NormFilling
                let nitrogenFilling: NormFilling
                let phosphateFilling: NormFilling

                try {
                    const baseInput =
                        await fillingFuncs.collectInputForFertilizerApplicationFilling(
                            fdm,
                            principalId,
                            field.b_id,
                            phosphate?.normValue ?? 0,
                        )
                    const fillingInput = {
                        ...baseInput,
                        applications: syntheticApps,
                        fertilizers,
                    } as Awaited<
                        ReturnType<
                            typeof fillingFuncs.collectInputForFertilizerApplicationFilling
                        >
                    >
                    const [manureResult, nitrogenResult, phosphateResult] =
                        await Promise.all([
                            Promise.resolve(
                                fillingFuncs.calculateFertilizerApplicationFillingForManure(
                                    fdm,
                                    fillingInput,
                                ),
                            ),
                            fillingFuncs.calculateFertilizerApplicationFillingForNitrogen(
                                fdm,
                                fillingInput,
                            ),
                            Promise.resolve(
                                fillingFuncs.calculateFertilizerApplicationFillingForPhosphate(
                                    fdm,
                                    fillingInput,
                                ),
                            ),
                        ])
                    manureFilling = manureResult
                    nitrogenFilling = nitrogenResult
                    phosphateFilling = phosphateResult
                } catch (err) {
                    console.warn(
                        `[computePlanMetrics] Filling calc failed for ${field.b_id}:`,
                        err,
                    )
                    throw err
                }

                // Fetch NMI nutrient advice per field
                let advice: NutrientAdvice | null = null
                if (
                    nmiApiKey &&
                    isValidDutchCropCatalogue(field.b_lu_catalogue)
                ) {
                    try {
                        const [fieldData, currentSoilData] = await Promise.all([
                            getField(fdm, principalId, field.b_id),
                            getCurrentSoilData(fdm, principalId, field.b_id),
                        ])
                        advice = await getNutrientAdvice(fdm, {
                            b_lu_catalogue: field.b_lu_catalogue!,
                            b_centroid: fieldData.b_centroid ?? [0, 0],
                            currentSoilData,
                            nmiApiKey,
                            b_bufferstrip: fieldData.b_bufferstrip,
                        })
                    } catch (err) {
                        console.warn(
                            `[computePlanMetrics] NMI advice failed for ${field.b_id}:`,
                            err,
                        )
                    }
                }

                const proposedDose = calculateDose({
                    applications: syntheticApps,
                    fertilizers,
                })

                let omBalance = field.fieldMetrics?.omBalance ?? null
                if (omInput) {
                    const fieldOmInput = omInput.fields.find(
                        (f: any) => f.field.b_id === field.b_id,
                    )
                    if (fieldOmInput) {
                        try {
                            const omResult = calculateOrganicMatterBalanceField(
                                {
                                    fieldInput: {
                                        ...fieldOmInput,
                                        fertilizerApplications: syntheticApps,
                                    },
                                    fertilizerDetails:
                                        omInput.fertilizerDetails,
                                    cultivationDetails:
                                        omInput.cultivationDetails,
                                    timeFrame: timeframe,
                                },
                            )
                            omBalance = omResult.balance
                        } catch (e) {
                            console.warn(
                                `[computePlanMetrics] OM calc failed for ${field.b_id}:`,
                                e,
                            )
                        }
                    }
                }

                let nBalance: ReturnType<
                    typeof calculateNitrogenBalanceField
                > | null = null
                if (nInput) {
                    const fieldNInput = nInput.fields.find(
                        (f: any) => f.field.b_id === field.b_id,
                    )
                    if (fieldNInput) {
                        try {
                            nBalance = calculateNitrogenBalanceField({
                                fieldInput: {
                                    ...fieldNInput,
                                    fertilizerApplications: syntheticApps,
                                },
                                fertilizerDetails: nInput.fertilizerDetails,
                                cultivationDetails: nInput.cultivationDetails,
                                timeFrame: timeframe,
                            })
                        } catch (e) {
                            console.warn(
                                `[computePlanMetrics] N calc failed for ${field.b_id}:`,
                                e,
                            )
                        }
                    }
                }

                fieldMetricsMap[field.b_id] = {
                    normsFilling: {
                        manure: manureFilling,
                        nitrogen: nitrogenFilling,
                        phosphate: phosphateFilling,
                    },
                    norms: {
                        manure: manure!,
                        nitrogen: nitrogen!,
                        phosphate: phosphate!,
                    },
                    nBalance: nBalance
                        ? {
                              balance: nBalance.balance,
                              target: nBalance.target,
                              emission: nBalance.emission,
                          }
                        : null,
                    omBalance,
                    advice,
                    proposedDose: proposedDose.dose,
                }
                return {
                    b_id: field.b_id,
                    b_area: field.b_area ?? 0,
                    b_bufferstrip: field.b_bufferstrip,
                    nBalance,
                    fieldData: field,
                }
            }),
    )

    const validFields = fieldResults
        .filter(
            (
                r,
            ): r is PromiseFulfilledResult<{
                b_id: string
                b_area: number
                b_bufferstrip: boolean
                nBalance: ReturnType<
                    typeof calculateNitrogenBalanceField
                > | null
                fieldData: any
            }> => r.status === "fulfilled",
        )
        .map((r) => r.value)
        .filter((f) => fieldMetricsMap[f.b_id])

    if (validFields.length === 0) return null

    // Compute norms from ALL farm fields (matching simulateFarmPlan logic)
    // so the farm-level norm denominator is consistent.
    const allFarmFields = await getFields(
        fdm,
        principalId,
        b_id_farm,
        timeframe,
    )
    const allFarmFieldNorms = await Promise.all(
        allFarmFields
            .filter((f) => !f.b_bufferstrip && f.b_area)
            .map(async (f) => {
                try {
                    const norms = await getFieldNormValues({
                        fdm,
                        principal_id: principalId,
                        b_id: f.b_id,
                        calendar: year,
                    })
                    return {
                        b_id: f.b_id,
                        b_area: f.b_area ?? 0,
                        norms,
                    }
                } catch {
                    return null
                }
            }),
    )

    const farmNormsKg = aggregateNormsToFarmLevel(
        allFarmFieldNorms
            .filter(
                (
                    field,
                ): field is NonNullable<(typeof allFarmFieldNorms)[number]> =>
                    field?.b_id != null && field.norms != null,
            )
            .map((field) => ({
                b_id: field.b_id,
                b_area: field.b_area ?? 0,
                norms: field.norms,
            })),
    )

    const farmFillingsKg = aggregateNormFillingsToFarmLevel(
        validFields.map((f) => ({
            b_id: f.b_id,
            b_area: f.b_area,
            normsFilling: fieldMetricsMap[f.b_id].normsFilling,
        })),
    )

    const fieldsWithNBalance = validFields.filter((f) => f.nBalance !== null)
    const farmNBalance =
        fieldsWithNBalance.length > 0
            ? calculateNitrogenBalancesFieldToFarm(
                  fieldsWithNBalance.map((f) => ({
                      b_id: f.b_id,
                      b_area: f.b_area,
                      b_bufferstrip: f.b_bufferstrip,
                      balance: f.nBalance!,
                  })),
                  false,
                  [],
              )
            : null

    return {
        fieldMetricsMap,
        farmTotals: {
            normsFilling: farmFillingsKg,
            norms: farmNormsKg,
            nBalance: farmNBalance,
        },
    }
}
