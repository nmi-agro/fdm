import { FunctionTool, type Context } from "@google/adk"
import { z } from "zod"
import {
    getNutrientAdvice,
    createFunctionsForNorms,
    createUncachedFunctionsForFertilizerApplicationFilling,
    calculateOrganicMatterBalanceField,
    collectInputForOrganicMatterBalance,
    calculateNitrogenBalanceField,
    collectInputForNitrogenBalance,
    calculateNitrogenBalancesFieldToFarm,
    calculateDose,
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
import type {
    FdmType,
    PrincipalId,
    Fertilizer,
    FertilizerApplication,
} from "@nmi-agro/fdm-core"

interface AdviceArgs {
    b_ids: string[]
}

/**
 * Determines the main cultivation based on the "May 15th" rule.
 * It searches for a cultivation that is active on May 15th of the given calendar year.
 */
function getMainCultivation(cultivations: any[], calendarYear: string) {
    const targetDate = new Date(`${calendarYear}-05-15T12:00:00`)
    const sorted = [...cultivations].sort(
        (a, b) =>
            new Date(b.b_lu_start).getTime() - new Date(a.b_lu_start).getTime(),
    )
    return sorted.find((c) => {
        const start = new Date(c.b_lu_start)
        const end = c.b_lu_end ? new Date(c.b_lu_end) : null
        return end ? start <= targetDate && end >= targetDate : start <= targetDate
    })
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
            "Get the list of all fields belonging to the farm for the current year, including their main cultivation details.",
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
                    const mainLu = getMainCultivation(cultivations, input.calendar)
                    return {
                        b_id: f.b_id,
                        b_name: f.b_name,
                        b_area: f.b_area,
                        b_bufferstrip: f.b_bufferstrip,
                        b_lu_catalogue: mainLu?.b_lu_catalogue || null,
                        b_lu_name: mainLu?.b_lu_name || null,
                        b_lu_start: mainLu?.b_lu_start
                            ? new Date(mainLu.b_lu_start)
                                  .toISOString()
                                  .split("T")[0]
                            : null,
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
            strategies: z
                .object({
                    isOrganic: z.boolean().optional(),
                    fillManureSpace: z.boolean().optional(),
                    reduceAmmoniaEmissions: z.boolean().optional(),
                    keepNitrogenBalanceBelowTarget: z.boolean().optional(),
                    workOnRotationLevel: z.boolean().optional(),
                })
                .optional()
                .describe("User strategies to enforce in warnings"),
            fields: z
                .array(
                    z.object({
                        b_id: z.string().describe("The field ID"),
                        b_lu_catalogue: z.string().describe("The crop catalogue ID (e.g., nl_265) for this field"),
                        b_lu_name: z.string().describe("The name of the crop (e.g., Wintertarwe)"),
                        b_lu_start: z.string().describe("The sowing or start date of the crop (YYYY-MM-DD)"),
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
            const fillFuncs =
                createUncachedFunctionsForFertilizerApplicationFilling(
                    "NL",
                    calendar as any,
                )

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

                    // Build properly typed FertilizerApplication objects from proposed
                    // applications. Synthetic p_app_id values are used because these
                    // applications are not yet persisted in the database.
                    const proposedApps = fieldData.applications.map(
                        (app, idx) => {
                            const fertilizer = fertilizers.find(
                                (f: Fertilizer) =>
                                    f.p_id_catalogue === app.p_id_catalogue,
                            )
                            if (!fertilizer) {
                                throw new Error(
                                    `Fertilizer ${app.p_id_catalogue} not found in farm inventory.`,
                                )
                            }
                            return {
                                p_app_id: `synth-${fieldData.b_id}-${idx}`,
                                p_id: fertilizer.p_id,
                                p_id_catalogue: app.p_id_catalogue,
                                p_app_amount: app.p_app_amount,
                                p_app_date: new Date(app.p_app_date),
                                p_app_method: app.p_app_method ?? null,
                            } as unknown as FertilizerApplication
                        },
                    )

                    // Calculate legal norms (phosphate.normValue is required as
                    // input to the filling functions).
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

                    // Calculate norm fillings using the proper Dutch regulatory logic
                    // from fdm-calculator (Table 9 werkingscoëfficiënten, Table 11
                    // mestcodes, organic-rich fertilizer discount regulation).
                    const collectedFillingInput =
                        await fillFuncs.collectInputForFertilizerApplicationFilling(
                            fdm,
                            principalId,
                            fieldData.b_id,
                            phosphate.normValue,
                        )
                    const fillingInput = {
                        ...collectedFillingInput,
                        applications: proposedApps,
                    }
                    const [manureFilling, nitrogenFilling, phosphateFilling] =
                        await Promise.all([
                            fillFuncs.calculateFertilizerApplicationFillingForManure(
                                fillingInput,
                            ),
                            fillFuncs.calculateFertilizerApplicationFillingForNitrogen(
                                fillingInput,
                            ),
                            fillFuncs.calculateFertilizerApplicationFillingForPhosphate(
                                fillingInput,
                            ),
                        ])

                    // Calculate organic matter balance using proposed applications.
                    const fieldOmInput = omInput.fields.find(
                        (f: any) => f.field.b_id === fieldData.b_id,
                    )
                    let omBalance = null
                    let omBalanceError: string | null = null
                    if (fieldOmInput) {
                        try {
                            omBalance = calculateOrganicMatterBalanceField({
                                fieldInput: {
                                    ...fieldOmInput,
                                    fertilizerApplications: proposedApps,
                                },
                                fertilizerDetails: omInput.fertilizerDetails,
                                cultivationDetails: omInput.cultivationDetails,
                                timeFrame: timeframe,
                            })
                        } catch (e) {
                            omBalanceError =
                                e instanceof Error ? e.message : String(e)
                        }
                    }

                    // Calculate nitrogen balance using proposed applications.
                    const fieldNInput = nInput.fields.find(
                        (f: any) => f.field.b_id === fieldData.b_id,
                    )
                    let nBalance = null
                    let nBalanceError: string | null = null
                    if (fieldNInput) {
                        try {
                            nBalance = calculateNitrogenBalanceField({
                                fieldInput: {
                                    ...fieldNInput,
                                    fertilizerApplications: proposedApps,
                                },
                                fertilizerDetails: nInput.fertilizerDetails,
                                cultivationDetails: nInput.cultivationDetails,
                                timeFrame: timeframe,
                            })
                        } catch (e) {
                            nBalanceError =
                                e instanceof Error ? e.message : String(e)
                        }
                    }

                    // Calculate nutrient doses from the proposed plan so the agent
                    // can compare what the plan provides against the nutrient advice.
                    const proposedDose = calculateDose({
                        applications: proposedApps,
                        fertilizers,
                    }).dose

                    return {
                        b_id: fieldData.b_id,
                        b_area: fieldInfo.b_area,
                        // Structured for aggregateNormFillingsToFarmLevel
                        normsFilling: {
                            manure: manureFilling,
                            nitrogen: nitrogenFilling,
                            phosphate: phosphateFilling,
                        },
                        // Structured for aggregateNormsToFarmLevel
                        norms: {
                            manure,
                            nitrogen,
                            phosphate,
                        },
                        // Proposed nutrient dose (kg/ha) for comparison with nutrient advice
                        proposedDose,
                        omBalance: omBalance?.balance,
                        omBalanceError,
                        eomSupplyPerHa:
                            omBalance?.supply?.fertilizers?.total ?? null,
                        nBalance: nBalance || null,
                        nBalanceError,
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

            const farmNBalance = calculateNitrogenBalancesFieldToFarm(
                validFieldResults.map((r: any) => ({
                    b_id: r.b_id,
                    b_area: r.b_area,
                    b_bufferstrip: false,
                    balance: r.nBalance || undefined,
                })),
                false,
                [],
            )

            const hasBufferStripViolations = fieldResults.some(
                (r: any) => !r.isValid && r.error,
            )

            const complianceIssues: string[] = []
            const agronomicWarnings: string[] = []

            if (hasBufferStripViolations) {
                const bufferFields = fieldResults
                    .filter((r: any) => !r.isValid && r.error)
                    .map((r: any) => r.b_id)
                complianceIssues.push(
                    `Buffer strip violation: Fields [${bufferFields.join(", ")}] are buffer strips and cannot receive fertilizers.`,
                )
            }

            if (farmFillingsKg.manure > farmNormsKg.manure) {
                const excess = Math.round(
                    farmFillingsKg.manure - farmNormsKg.manure,
                )
                complianceIssues.push(
                    `Legal norm violation (Manure N): Farm exceeds the limit by ${excess} kg N. Total applied: ${farmFillingsKg.manure} kg, Limit: ${farmNormsKg.manure} kg.`,
                )
            }

            if (farmFillingsKg.nitrogen > farmNormsKg.nitrogen) {
                const excess = Math.round(
                    farmFillingsKg.nitrogen - farmNormsKg.nitrogen,
                )
                complianceIssues.push(
                    `Legal norm violation (Workable N): Farm exceeds the limit by ${excess} kg N. Total applied: ${farmFillingsKg.nitrogen} kg, Limit: ${farmNormsKg.nitrogen} kg.`,
                )
            }

            if (farmFillingsKg.phosphate > farmNormsKg.phosphate) {
                const excess = Math.round(
                    farmFillingsKg.phosphate - farmNormsKg.phosphate,
                )
                complianceIssues.push(
                    `Legal norm violation (Phosphate): Farm exceeds the limit by ${excess} kg P2O5. Total applied: ${farmFillingsKg.phosphate} kg, Limit: ${farmNormsKg.phosphate} kg.`,
                )
            }

            if (args.strategies?.isOrganic) {
                for (const field of args.fields) {
                    for (const app of field.applications) {
                        const fert = fertilizers.find(
                            (f: Fertilizer) =>
                                f.p_id_catalogue === app.p_id_catalogue,
                        )
                        if (fert?.p_type === "mineral") {
                            complianceIssues.push(
                                `Strategy violation (Organic Farming): Plan includes mineral fertilizer (${fert.p_id_catalogue} on field ${field.b_id}), which is not allowed.`,
                            )
                        }
                    }
                }
            }

            if (args.strategies?.keepNitrogenBalanceBelowTarget) {
                if (
                    farmNBalance.balance &&
                    farmNBalance.target &&
                    farmNBalance.balance > farmNBalance.target
                ) {
                    const excess = Math.round(
                        farmNBalance.balance - farmNBalance.target,
                    )
                    agronomicWarnings.push(
                        `Strategy warning (Nitrogen Target): The farm-level nitrogen balance (${Math.round(farmNBalance.balance)} kg N/ha) exceeds the target (${Math.round(farmNBalance.target)} kg N/ha) by ${excess} kg N/ha.`,
                    )
                }
                for (const r of validFieldResults) {
                    if (
                        r.nBalance?.balance &&
                        r.nBalance?.target &&
                        r.nBalance.balance > r.nBalance.target
                    ) {
                        const excess = Math.round(
                            r.nBalance.balance - r.nBalance.target,
                        )
                        agronomicWarnings.push(
                            `Strategy warning (Nitrogen Target): Field ${r.b_id} exceeds its N-balance target by ${excess} kg N/ha.`,
                        )
                    }
                }
            }

            if (args.strategies?.workOnRotationLevel) {
                const groupedByCrop: Record<string, typeof args.fields> = {}
                for (const field of args.fields) {
                    let cropGroup = field.b_lu_catalogue
                    // Normalize grassland codes
                    if (["nl_265", "nl_266", "nl_331"].includes(cropGroup)) {
                        cropGroup = "grassland"
                    }
                    if (!groupedByCrop[cropGroup]) {
                        groupedByCrop[cropGroup] = []
                    }
                    groupedByCrop[cropGroup].push(field)
                }

                for (const fields of Object.values(groupedByCrop)) {
                    if (fields.length <= 1) continue

                    const referenceField = fields[0]
                    const referenceApps = [...referenceField.applications].sort((a, b) => {
                        return a.p_id_catalogue.localeCompare(b.p_id_catalogue) ||
                               a.p_app_amount - b.p_app_amount ||
                               a.p_app_date.localeCompare(b.p_app_date)
                    })

                    for (let i = 1; i < fields.length; i++) {
                        const currentField = fields[i]
                        const currentApps = [...currentField.applications].sort((a, b) => {
                            return a.p_id_catalogue.localeCompare(b.p_id_catalogue) ||
                                   a.p_app_amount - b.p_app_amount ||
                                   a.p_app_date.localeCompare(b.p_app_date)
                        })

                        let mismatch = false
                        if (currentApps.length !== referenceApps.length) {
                            mismatch = true
                        } else {
                            for (let j = 0; j < referenceApps.length; j++) {
                                const ref = referenceApps[j]
                                const cur = currentApps[j]
                                if (
                                    ref.p_id_catalogue !== cur.p_id_catalogue ||
                                    ref.p_app_amount !== cur.p_app_amount ||
                                    ref.p_app_date !== cur.p_app_date ||
                                    ref.p_app_method !== cur.p_app_method
                                ) {
                                    mismatch = true
                                    break
                                }
                            }
                        }

                        if (mismatch) {
                            agronomicWarnings.push(
                                `Strategy warning (Rotation Level): Field ${currentField.b_id} (Crop: ${currentField.b_lu_name}) has different applications than other fields in the same group. For the "Work on Rotation Level" strategy, all fields with the same crop must receive identical applications.`,
                            )
                        }
                    }
                }
            }

            if (args.strategies?.fillManureSpace) {
                if (farmFillingsKg.manure < farmNormsKg.manure * 0.95) {
                    // warn if less than 95% full
                    const remaining = Math.round(
                        farmNormsKg.manure - farmFillingsKg.manure,
                    )
                    agronomicWarnings.push(
                        `Strategy warning (Fill Manure Space): The farm has unused manure space (${remaining} kg N available). Consider adding more manure to maximize usage.`,
                    )
                }
            }

            for (const r of validFieldResults) {
                if (r.omBalance && r.omBalance < 0) {
                    agronomicWarnings.push(
                        `Strategy warning (Organic Matter): Field ${r.b_id} has a negative organic matter balance (${Math.round(r.omBalance)} kg EOM/ha). Consider applying compost or other fertilizer with a high EOM content.`,
                    )
                }
            }

            return {
                fieldResults,
                // Farm-level totals in kg — legal compliance is verified here, NOT per field
                farmTotals: {
                    normsFilling: farmFillingsKg,
                    norms: farmNormsKg,
                    nBalance: farmNBalance,
                },
                isValid: complianceIssues.length === 0,
                complianceIssues,
                agronomicWarnings,
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
    b_lu_catalogue: string
    b_lu_name: string
    b_lu_start: string
    applications: {
        p_id_catalogue: string
        p_app_amount: number
        p_app_date: string
        p_app_method?: string
    }[]
}

interface SimulationArgs {
    b_id_farm: string
    strategies?: {
        isOrganic?: boolean
        fillManureSpace?: boolean
        reduceAmmoniaEmissions?: boolean
        keepNitrogenBalanceBelowTarget?: boolean
        workOnRotationLevel?: boolean
    }
    fields: SimulationField[]
}
