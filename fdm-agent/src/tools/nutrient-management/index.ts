import { FunctionTool, type Context } from "@google/adk"
import { z } from "zod"
import {
    getNutrientAdvice,
    createFunctionsForNorms,
    calculateOrganicMatterBalanceField,
    collectInputForOrganicMatterBalance,
    calculateNitrogenBalanceField,
    collectInputForNitrogenBalance,
    aggregateNormsToFarmLevel,
    aggregateNormFillingsToFarmLevel,
} from "@nmi-agro/fdm-calculator"
import {
    getFertilizers,
    getCultivations,
    getCurrentSoilData,
    getField,
    getFields,
} from "@nmi-agro/fdm-core"
import type { FdmType, PrincipalId, Fertilizer } from "@nmi-agro/fdm-core"

interface AdviceArgs {
    b_ids: string[]
}

/**
 * Creates tools for nutrient management.
 * @param fdm The non-serializable FDM database instance.
 */
export function createNutrientManagementTools(fdm: FdmType) {
    /**
     * Tool for fetching the list of fields for a farm.
     */
    const getFarmFieldsTool = new FunctionTool({
        name: "getFarmFields",
        description:
            "Get the list of all fields belonging to the farm for the current year.",
        parameters: z.object({
            b_id_farm: z.string().describe("The ID of the farm"),
            calendar: z.string().describe('The calendar year (e.g. "2025")'),
        }) as any,
        execute: async (input: any, context?: Context) => {
            if (!context) throw new Error("Context is required")
            const principalId = context.state.get("principalId") as PrincipalId
            const timeframe = {
                start: new Date(`${input.calendar}-01-01`),
                end: new Date(`${input.calendar}-12-31`),
            }

            const fields = await getFields(
                fdm,
                principalId,
                input.b_id_farm,
                timeframe,
            )
            const fieldDetails = await Promise.all(
                fields.map(async (f) => {
                    const cultivations = await getCultivations(
                        fdm,
                        principalId,
                        f.b_id,
                        timeframe,
                    )
                    return {
                        b_id: f.b_id,
                        b_name: f.b_name,
                        b_area: f.b_area,
                        b_bufferstrip: f.b_bufferstrip,
                        b_lu_catalogue: cultivations[0]?.b_lu_catalogue || null,
                        b_lu_name: cultivations[0]?.b_lu_name || null,
                    }
                }),
            )
            // Must return an object (not array) — Gemini rejects array as top-level function_response.
            return { fields: fieldDetails }
        },
    })

    /**
     * Tool for fetching nutrient advice (N, P, K and others).
     */
    const getFarmNutrientAdviceTool = new FunctionTool({
        name: "getFarmNutrientAdvice",
        description:
            "Get the full nutrient advice (N, P, K, Ca, Mg, S, micro-nutrients) for specific fields based on soil samples and crop rotation.",
        parameters: z.object({
            b_ids: z
                .array(z.string())
                .describe("List of field IDs (b_id) to fetch advice for"),
        }) as any,
        execute: async (input: any, context?: Context) => {
            if (!context) throw new Error("Context is required")
            const principalId = context.state.get("principalId") as PrincipalId
            // nmiApiKey is injected server-side via context state — never exposed to the LLM.
            const nmiApiKey = context.state.get("nmiApiKey") as
                | string
                | undefined
            const args = input as AdviceArgs

            const results = await Promise.all(
                args.b_ids.map(async (b_id) => {
                    const field = await getField(fdm, principalId, b_id)
                    const cultivations = await getCultivations(
                        fdm,
                        principalId,
                        b_id,
                    )
                    const currentSoilData = await getCurrentSoilData(
                        fdm,
                        principalId,
                        b_id,
                    )

                    const advice = await getNutrientAdvice(fdm, {
                        b_lu_catalogue: cultivations[0]?.b_lu_catalogue || "",
                        b_centroid: field.b_centroid ?? [0, 0],
                        currentSoilData: currentSoilData,
                        nmiApiKey: nmiApiKey || "",
                        b_bufferstrip: field.b_bufferstrip,
                    })
                    return { b_id, advice }
                }),
            )
            // Must return an object (not array) — Gemini rejects array as top-level function_response.
            return { advicePerField: results }
        },
    })

    /**
     * Tool for fetching legal norms (Animal Manure N, Workable N, Phosphate).
     */
    const getFarmLegalNormsTool = new FunctionTool({
        name: "getFarmLegalNorms",
        description:
            "Get the three legal limits (Animal Manure Nitrogen, Total Workable Nitrogen, and Phosphate) for fields.",
        parameters: z.object({
            b_id_farm: z.string().describe("The ID of the farm"),
            b_ids: z
                .array(z.string())
                .describe("List of field IDs (b_id) to check"),
        }) as any,
        execute: async (input: any, context?: Context) => {
            if (!context) throw new Error("Context is required")
            const principalId = context.state.get("principalId") as PrincipalId
            const calendar =
                (context.state.get("calendar") as string) ||
                new Date().getFullYear().toString()

            const normFunctions = createFunctionsForNorms("NL", calendar as any)
            const results = await Promise.all(
                input.b_ids.map(async (b_id: string) => {
                    const normsInput = await normFunctions.collectInputForNorms(
                        fdm,
                        principalId,
                        b_id,
                    )
                    const [manure, phosphate, nitrogen] = await Promise.all([
                        normFunctions.calculateNormForManure(
                            fdm,
                            normsInput as any,
                        ),
                        normFunctions.calculateNormForPhosphate(
                            fdm,
                            normsInput as any,
                        ),
                        normFunctions.calculateNormForNitrogen(
                            fdm,
                            normsInput as any,
                        ),
                    ])
                    return {
                        b_id,
                        norms: {
                            animalManureN: manure.normValue,
                            workableN: nitrogen.normValue,
                            phosphate: phosphate.normValue,
                        },
                    }
                }),
            )
            // Must return an object (not array) — Gemini rejects array as top-level function_response.
            return { normsPerField: results }
        },
    })

    /**
     * Tool for searching fertilizers in the farm inventory.
     */
    const searchFertilizersTool = new FunctionTool({
        name: "searchFertilizers",
        description:
            "Search for fertilizer products available in the farm inventory (including custom ones) by name or type.",
        parameters: z.object({
            b_id_farm: z
                .string()
                .describe("The ID of the farm to search inventory for"),
            query: z
                .string()
                .optional()
                .describe('Search term (e.g. "pig manure", "KAS")'),
            p_type: z
                .enum(["manure", "mineral", "compost"])
                .optional()
                .describe("Filter by fertilizer type"),
        }) as any,
        execute: async (input: any, context?: Context) => {
            if (!context) throw new Error("Context is required")
            const args = input as SearchArgs
            const principalId = context.state.get("principalId") as PrincipalId

            if (!fdm || !principalId || !args.b_id_farm) {
                return { fertilizers: [] }
            }

            const farmFertilizers = await getFertilizers(
                fdm,
                principalId,
                args.b_id_farm,
            )
            let results = [...farmFertilizers]

            if (args.p_type) {
                results = results.filter((f) => f.p_type === args.p_type)
            }

            if (args.query) {
                const q = args.query.toLowerCase()
                results = results.filter(
                    (f) =>
                        f.p_name_nl?.toLowerCase().includes(q) ||
                        f.p_id_catalogue?.toLowerCase().includes(q),
                )
            }

            // Must return an object (not array) — Gemini rejects array as top-level function_response.
            return {
                fertilizers: results.slice(0, 50).map((f) => ({
                    p_id: f.p_id,
                    p_id_catalogue: f.p_id_catalogue,
                    p_name_nl: f.p_name_nl,
                    p_type: f.p_type,
                    p_app_method_options: f.p_app_method_options || [],
                    p_n_rt: f.p_n_rt,
                    p_n_wc: f.p_n_wc,
                    p_p_rt: f.p_p_rt,
                    p_k_rt: f.p_k_rt,
                    p_mg_rt: f.p_mg_rt,
                    p_ca_rt: f.p_ca_rt,
                    p_s_rt: f.p_s_rt,
                    p_cu_rt: f.p_cu_rt,
                    p_zn_rt: f.p_zn_rt,
                    p_b_rt: f.p_b_rt,
                    p_om: f.p_om,
                    p_eom: f.p_eom,
                    p_ef_nh3: f.p_ef_nh3,
                    p_source: f.p_source,
                })),
            }
        },
    })

    /**
     * Tool for simulating farm plans and checking compliance across all 3 norms and organic matter balance.
     */
    const simulateFarmPlanTool = new FunctionTool({
        name: "simulateFarmPlan",
        description:
            "Simulates a proposed fertilizer plan to check compliance against all 3 legal norms, organic matter balance, and nitrogen balance.",
        parameters: z.object({
            b_id_farm: z.string().describe("The ID of the farm"),
            fields: z
                .array(
                    z.object({
                        b_id: z.string().describe("The field ID"),
                        applications: z.array(
                            z.object({
                                p_id_catalogue: z.string(),
                                p_app_amount: z
                                    .number()
                                    .describe("Application amount in kg/ha"),
                                p_app_date: z
                                    .string()
                                    .describe(
                                        "Application date in YYYY-MM-DD format",
                                    ),
                                p_app_method: z.string().optional(),
                            }),
                        ),
                    }),
                )
                .describe("Proposed applications per field"),
        }) as any,
        execute: async (input: any, context?: Context) => {
            if (!context) throw new Error("Context is required")
            const args = input as SimulationArgs
            const principalId = context.state.get("principalId") as PrincipalId
            const calendar =
                (context.state.get("calendar") as string) ||
                new Date().getFullYear().toString()

            if (!fdm || !principalId || !args.b_id_farm) {
                throw new Error("Database connection or Farm ID missing")
            }

            const timeframe = {
                start: new Date(`${calendar}-01-01`),
                end: new Date(`${calendar}-12-31`),
            }

            const [omInput, nInput, fertilizers] = await Promise.all([
                collectInputForOrganicMatterBalance(
                    fdm,
                    principalId,
                    args.b_id_farm,
                    timeframe,
                ),
                collectInputForNitrogenBalance(
                    fdm,
                    principalId,
                    args.b_id_farm,
                    timeframe,
                ),
                getFertilizers(fdm, principalId, args.b_id_farm),
            ])

            const normFuncs = createFunctionsForNorms("NL", calendar as any)

            const fieldResults = await Promise.all(
                args.fields.map(async (fieldData) => {
                    const fieldInfo = await getField(
                        fdm,
                        principalId,
                        fieldData.b_id,
                    )

                    if (
                        fieldInfo.b_bufferstrip &&
                        fieldData.applications.length > 0
                    ) {
                        return {
                            b_id: fieldData.b_id,
                            error: "Field is a buffer strip and cannot receive fertilizer applications.",
                            isValid: false,
                            filling: {
                                animalManureN: 0,
                                workableN: 0,
                                phosphate: 0,
                            },
                            norms: {
                                animalManureN: 0,
                                workableN: 0,
                                phosphate: 0,
                            },
                        }
                    }

                    const appsWithDetails = fieldData.applications.map(
                        (app) => {
                            const details = fertilizers.find(
                                (f: Fertilizer) =>
                                    f.p_id_catalogue === app.p_id_catalogue,
                            )
                            if (!details) {
                                throw new Error(
                                    `Fertilizer ${app.p_id_catalogue} not found in farm inventory.`,
                                )
                            }
                            return {
                                ...app,
                                ...details,
                                p_app_date: new Date(app.p_app_date),
                            }
                        },
                    )

                    // Calculate filling directly from fertilizer properties (all values in kg/ha).
                    // p_app_amount is in kg/ha; nutrient content values are in g/kg → divide by 1000.
                    const manureFillingPerHa = appsWithDetails.reduce(
                        (sum, app) => {
                            if (app.p_type === "manure") {
                                return (
                                    sum +
                                    ((app.p_app_amount ?? 0) *
                                        (app.p_n_rt ?? 0)) /
                                        1000
                                )
                            }
                            return sum
                        },
                        0,
                    )
                    const workableNFillingPerHa = appsWithDetails.reduce(
                        (sum, app) =>
                            sum +
                            ((app.p_app_amount ?? 0) * (app.p_n_wc ?? 0)) /
                                1000,
                        0,
                    )
                    const phosphateFillingPerHa = appsWithDetails.reduce(
                        (sum, app) =>
                            sum +
                            ((app.p_app_amount ?? 0) * (app.p_p_rt ?? 0)) /
                                1000,
                        0,
                    )

                    const normsInput = await normFuncs.collectInputForNorms(
                        fdm,
                        principalId,
                        fieldData.b_id,
                    )
                    const [manure, phosphate, nitrogen] = await Promise.all([
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

                    const fieldOmInput = omInput.fields.find(
                        (f: any) => f.field.b_id === fieldData.b_id,
                    )
                    let omBalance = null
                    if (fieldOmInput) {
                        try {
                            omBalance = calculateOrganicMatterBalanceField({
                                fieldInput: {
                                    ...fieldOmInput,
                                    fertilizerApplications:
                                        appsWithDetails as any,
                                },
                                fertilizerDetails: omInput.fertilizerDetails,
                                cultivationDetails: omInput.cultivationDetails,
                                timeFrame: timeframe,
                            })
                        } catch (e) {}
                    }

                    const fieldNInput = nInput.fields.find(
                        (f: any) => f.field.b_id === fieldData.b_id,
                    )
                    let nBalance = null
                    if (fieldNInput) {
                        try {
                            nBalance = calculateNitrogenBalanceField({
                                fieldInput: {
                                    ...fieldNInput,
                                    fertilizerApplications:
                                        appsWithDetails as any,
                                },
                                fertilizerDetails: nInput.fertilizerDetails,
                                cultivationDetails: nInput.cultivationDetails,
                                timeFrame: timeframe,
                            })
                        } catch (e) {}
                    }

                    return {
                        b_id: fieldData.b_id,
                        b_area: fieldInfo.b_area,
                        // Per-hectare values — for agronomic review per field
                        fillingPerHa: {
                            animalManureN: manureFillingPerHa,
                            workableN: workableNFillingPerHa,
                            phosphate: phosphateFillingPerHa,
                        },
                        normPerHa: {
                            animalManureN: manure.normValue,
                            workableN: nitrogen.normValue,
                            phosphate: phosphate.normValue,
                        },
                        // Structured for aggregateNormFillingsToFarmLevel
                        normsFilling: {
                            manure: {
                                normFilling: manureFillingPerHa,
                                applicationFilling: [],
                            },
                            nitrogen: {
                                normFilling: workableNFillingPerHa,
                                applicationFilling: [],
                            },
                            phosphate: {
                                normFilling: phosphateFillingPerHa,
                                applicationFilling: [],
                            },
                        },
                        // Structured for aggregateNormsToFarmLevel
                        norms: {
                            manure,
                            nitrogen,
                            phosphate,
                        },
                        omBalance: omBalance?.balance,
                        nBalance: nBalance
                            ? {
                                  balance: nBalance.balance,
                                  target: nBalance.target,
                                  isBelowTarget:
                                      nBalance.balance <= nBalance.target,
                              }
                            : null,
                        isValid: true,
                    }
                }),
            )

            const validFieldResults = fieldResults.filter(
                (r: any) => r.isValid && r.b_area,
            )

            // Aggregate to farm level using fdm-calculator functions.
            // Norms are in kg/ha per field; aggregation multiplies by area to get total kg for the farm.
            const farmNormsKg = aggregateNormsToFarmLevel(
                validFieldResults.map((r: any) => ({
                    b_id: r.b_id,
                    b_area: r.b_area,
                    norms: r.norms,
                })),
            )

            const farmFillingsKg = aggregateNormFillingsToFarmLevel(
                validFieldResults.map((r: any) => ({
                    b_id: r.b_id,
                    b_area: r.b_area,
                    normsFilling: r.normsFilling,
                })),
            )

            const nBalanceTotalKg = validFieldResults.reduce(
                (sum: number, r: any) => {
                    if (r.nBalance)
                        return sum + (r.nBalance.balance ?? 0) * (r.b_area ?? 0)
                    return sum
                },
                0,
            )
            const nTargetTotalKg = validFieldResults.reduce(
                (sum: number, r: any) => {
                    if (r.nBalance)
                        return sum + (r.nBalance.target ?? 0) * (r.b_area ?? 0)
                    return sum
                },
                0,
            )

            const hasBufferStripViolations = fieldResults.some(
                (r: any) => !r.isValid && r.error,
            )

            return {
                fieldResults,
                // Farm-level totals in kg — legal compliance is verified here, NOT per field
                farmTotals: {
                    fillingKg: {
                        animalManureN: farmFillingsKg.manure,
                        workableN: farmFillingsKg.nitrogen,
                        phosphate: farmFillingsKg.phosphate,
                    },
                    normKg: {
                        animalManureN: farmNormsKg.manure,
                        workableN: farmNormsKg.nitrogen,
                        phosphate: farmNormsKg.phosphate,
                    },
                    nBalanceKg: nBalanceTotalKg,
                    nTargetKg: nTargetTotalKg,
                    nBalanceValid: nBalanceTotalKg <= nTargetTotalKg,
                },
                isValid:
                    !hasBufferStripViolations &&
                    farmFillingsKg.manure <= farmNormsKg.manure &&
                    farmFillingsKg.nitrogen <= farmNormsKg.nitrogen &&
                    farmFillingsKg.phosphate <= farmNormsKg.phosphate,
            }
        },
    })

    return [
        getFarmFieldsTool,
        getFarmNutrientAdviceTool,
        getFarmLegalNormsTool,
        searchFertilizersTool,
        simulateFarmPlanTool,
    ]
}

interface SearchArgs {
    b_id_farm: string
    query?: string
    p_type?: "manure" | "mineral" | "compost"
}

interface SimulationField {
    b_id: string
    applications: {
        p_id_catalogue: string
        p_app_amount: number
        p_app_date: string
        p_app_method?: string
    }[]
}

interface SimulationArgs {
    b_id_farm: string
    fields: SimulationField[]
}
