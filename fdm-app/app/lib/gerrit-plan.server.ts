/**
 * Server-side plan enrichment for Gerrit.
 * Extracted so it can be used from both the SSE stream route and the accept action.
 */
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
    createFunctionsForNorms,
    getNutrientAdvice,
    type NormFilling,
    type NutrientAdvice,
} from "@nmi-agro/fdm-calculator"
import {
    fromKgPerHa,
    getCurrentSoilData,
    getFertilizers,
    getFertilizerParametersDescription,
    getField,
    type Fertilizer,
    type FertilizerApplication,
    type PrincipalId,
} from "@nmi-agro/fdm-core"
import type { FieldMetrics, ParsedPlan } from "~/components/blocks/gerrit/types"
import type { EnrichedPlanRow, GerritPlan } from "~/store/gerrit-session"
import { fdm } from "./fdm.server"

export interface RawFieldData {
    b_id: string
    b_name: string
    b_lu_catalogue: string
    b_lu_name: string
    b_lu_croprotation: string | null
    b_area: number | null
    b_bufferstrip: boolean
    b_soiltype_agr: string | null
    b_gwl_class: string | null
    a_som_loi: number | null
}

/**
 * Enriches raw ParsedPlan from the agent with fertilizer names, application
 * method labels and NMI field metrics.
 */
export async function enrichAndComputePlan(
    principalId: PrincipalId,
    b_id_farm: string,
    calendar: string,
    parsedPlan: ParsedPlan,
    fieldsData: RawFieldData[],
    nmiApiKey?: string,
): Promise<GerritPlan> {
    const fertilizers = await getFertilizers(fdm, principalId, b_id_farm)
    const fertilizerParameterDescription = getFertilizerParametersDescription()
    const applicationMethods = fertilizerParameterDescription.find(
        (x: any) => x.parameter === "p_app_method_options",
    )

    const enrichedPlan: EnrichedPlanRow[] = fieldsData.map((fd) => {
        const proposedField = parsedPlan.plan?.find((p) => p.b_id === fd.b_id)
        return {
            b_id: fd.b_id,
            b_name: fd.b_name,
            b_lu_catalogue: fd.b_lu_catalogue,
            b_lu_name: fd.b_lu_name,
            b_lu_croprotation: fd.b_lu_croprotation,
            b_area: fd.b_area,
            b_bufferstrip: fd.b_bufferstrip,
            applications: (proposedField?.applications || []).map((app) => {
                const fert = fertilizers.find(
                    (f: Fertilizer) => f.p_id_catalogue === app.p_id_catalogue,
                )
                const methodMeta = applicationMethods?.options?.find(
                    (x: any) => x.value === app.p_app_method,
                )
                const unit = fert?.p_app_amount_unit ?? "kg/ha"
                const display = fromKgPerHa(
                    app.p_app_amount,
                    unit,
                    fert?.p_density,
                )
                return {
                    ...app,
                    p_name_nl: fert?.p_name_nl || app.p_id_catalogue,
                    p_type: fert?.p_type || "other",
                    p_app_method_name:
                        methodMeta?.label ?? app.p_app_method ?? null,
                    p_app_amount_display: display ?? app.p_app_amount,
                    p_app_amount_unit: unit,
                }
            }),
            fieldRecommendation: (proposedField as any)?.fieldRecommendation ?? undefined,
            fieldMetrics: (proposedField as any)?.fieldMetrics ?? null,
        }
    })

    const metrics = await computePlanMetrics(
        principalId,
        b_id_farm,
        calendar,
        enrichedPlan,
        fertilizers,
        nmiApiKey,
    ).catch(() => null)

    for (const field of enrichedPlan) {
        field.fieldMetrics = metrics?.fieldMetricsMap?.[field.b_id] ?? null
    }

    return {
        summary: parsedPlan.summary ?? "",
        suggestedFollowUps: parsedPlan.suggestedFollowUps ?? [],
        plan: enrichedPlan,
        metrics: metrics ? { farmTotals: metrics.farmTotals as import("~/components/blocks/gerrit/types").FarmTotals } : null,
        rawPlan: parsedPlan,
    }
}

async function computePlanMetrics(
    principalId: PrincipalId,
    b_id_farm: string,
    calendar: string,
    enrichedPlan: EnrichedPlanRow[],
    fertilizers: Awaited<ReturnType<typeof getFertilizers>>,
    nmiApiKey?: string,
) {
    const year = (
        ["2025", "2026"].includes(calendar) ? calendar : "2025"
    ) as "2025" | "2026"
    const normFuncs = createFunctionsForNorms("NL", year)
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
                let manure: { normValue: number; normSource: string }
                let nitrogen: { normValue: number; normSource: string }
                let phosphate: { normValue: number; normSource: string }

                const normsInput = await normFuncs.collectInputForNorms(
                    fdm,
                    principalId,
                    field.b_id,
                )
                const [manureResult, phosphateResult, nitrogenResult] =
                    await Promise.all([
                        normFuncs.calculateNormForManure(
                            fdm,
                            normsInput as any,
                        ),
                        normFuncs.calculateNormForPhosphate(
                            fdm,
                            normsInput as any,
                        ),
                        normFuncs.calculateNormForNitrogen(
                            fdm,
                            normsInput as any,
                        ),
                    ])
                manure = {
                    normValue: manureResult.normValue,
                    normSource: manureResult.normSource,
                }
                phosphate = {
                    normValue: phosphateResult.normValue,
                    normSource: phosphateResult.normSource,
                }
                nitrogen = {
                    normValue: nitrogenResult.normValue,
                    normSource: nitrogenResult.normSource,
                }

                const syntheticApps: FertilizerApplication[] =
                    field.applications.map((app, i) => {
                        const fert = fertilizers.find(
                            (f) => f.p_id_catalogue === app.p_id_catalogue,
                        )
                        return {
                            p_id: fert?.p_id ?? app.p_id_catalogue,
                            p_id_catalogue: app.p_id_catalogue,
                            p_name_nl: fert?.p_name_nl ?? null,
                            p_app_amount: app.p_app_amount,
                            p_app_date: new Date(app.p_app_date),
                            p_app_id: `plan-${field.b_id}-${i}`,
                            p_app_method: app.p_app_method ?? null,
                        } as unknown as FertilizerApplication
                    })

                let manureFilling: NormFilling
                let nitrogenFilling: NormFilling
                let phosphateFilling: NormFilling

                const baseInput =
                    await fillingFuncs.collectInputForFertilizerApplicationFilling(
                        fdm,
                        principalId,
                        field.b_id,
                        phosphate.normValue,
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
                const [manureF, nitrogenF, phosphateF] = await Promise.all([
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
                manureFilling = manureF
                nitrogenFilling = nitrogenF
                phosphateFilling = phosphateF

                // NMI nutrient advice
                let advice: NutrientAdvice | null = null
                if (nmiApiKey && field.b_lu_catalogue) {
                    try {
                        const [fieldData, currentSoilData] = await Promise.all([
                            getField(fdm, principalId, field.b_id),
                            getCurrentSoilData(fdm, principalId, field.b_id),
                        ])
                        advice = await getNutrientAdvice(fdm, {
                            b_lu_catalogue: field.b_lu_catalogue,
                            b_centroid: fieldData.b_centroid ?? [0, 0],
                            currentSoilData,
                            nmiApiKey,
                            b_bufferstrip: fieldData.b_bufferstrip,
                        })
                    } catch {
                        // NMI advice optional
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
                        } catch {
                            // OM calc optional
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
                        } catch {
                            // N balance optional
                        }
                    }
                }

                fieldMetricsMap[field.b_id] = {
                    normsFilling: {
                        manure: manureFilling,
                        nitrogen: nitrogenFilling,
                        phosphate: phosphateFilling,
                    },
                    norms: { manure, nitrogen, phosphate },
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
                }
            }),
    )

    const validFields = fieldResults
        .filter(
            (r): r is PromiseFulfilledResult<{ b_id: string; b_area: number; b_bufferstrip: boolean; nBalance: ReturnType<typeof calculateNitrogenBalanceField> | null }> =>
                r.status === "fulfilled",
        )
        .map((r) => r.value)
        .filter((f) => fieldMetricsMap[f.b_id])

    if (validFields.length === 0) return null

    const farmNormsKg = aggregateNormsToFarmLevel(
        validFields.map((f) => ({
            b_id: f.b_id,
            b_area: f.b_area,
            norms: fieldMetricsMap[f.b_id].norms,
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
            nBalance: farmNBalance
                ? {
                      balance: farmNBalance.balance,
                      target: farmNBalance.target,
                      emission: farmNBalance.emission,
                  }
                : null,
        },
    }
}
