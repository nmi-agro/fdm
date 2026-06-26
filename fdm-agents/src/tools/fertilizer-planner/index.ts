import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import type { RunnableConfig } from "@langchain/core/runnables"
import { tool } from "@langchain/core/tools"
import {
  aggregateNormFillingsToFarmLevel,
  aggregateNormsToFarmLevel,
  calculateDose,
  calculateNitrogenBalanceField,
  calculateNitrogenBalancesFieldToFarm,
  calculateOrganicMatterBalanceField,
  collectInputForNitrogenBalance,
  collectInputForOrganicMatterBalance,
  createFunctionsForNorms,
  createUncachedFunctionsForFertilizerApplicationFilling,
  getNutrientAdvice,
} from "@nmi-agro/fdm-calculator"
import type { FdmType, Fertilizer, FertilizerApplication, PrincipalId } from "@nmi-agro/fdm-core"
import {
  getCultivations,
  getCurrentSoilData,
  getFertilizers,
  getField,
  getFields,
} from "@nmi-agro/fdm-core"
import { z } from "zod"

interface AdviceArgs {
  b_ids: string[]
}

export function isValidDutchCropCatalogue(b_lu_catalogue: string | null | undefined) {
  return /^nl_\d+$/.test(b_lu_catalogue ?? "")
}

/**
 * Determines the main cultivation based on the "May 15th" rule.
 * It searches for a cultivation that is active on May 15th of the given calendar year.
 */
export function getMainCultivation(cultivations: any[], calendarYear: string) {
  const targetDate = new Date(`${calendarYear}-05-15T12:00:00`)
  const sorted = [...cultivations].sort(
    (a, b) => new Date(b.b_lu_start).getTime() - new Date(a.b_lu_start).getTime(),
  )
  return sorted.find((c) => {
    const start = new Date(c.b_lu_start)
    const end = c.b_lu_end ? new Date(c.b_lu_end) : null
    return end ? start <= targetDate && end >= targetDate : start <= targetDate
  })
}

/**
 * Creates tools for the fertilizer application planner.
 * @param fdm The non-serializable FDM database instance.
 */
export function createFertilizerPlannerTools(fdm: FdmType) {
  /**
   * Tool for fetching the list of fields for a farm.
   */
  const getFarmFieldsTool = tool(
    async (input: any, config?: RunnableConfig) => {
      const principalId = config?.configurable?.principalId as PrincipalId
      if (!principalId) {
        throw new Error("Missing principalId in agent context")
      }
      const timeframe = {
        start: new Date(`${input.calendar}-01-01`),
        end: new Date(`${input.calendar}-12-31`),
      }

      const fields = await getFields(fdm, principalId, input.b_id_farm, timeframe)
      const fieldDetails = await Promise.all(
        fields.map(async (f) => {
          const cultivations = await getCultivations(fdm, principalId, f.b_id, timeframe)
          const currentSoilData = await getCurrentSoilData(fdm, principalId, f.b_id, timeframe)
          const mainLu = getMainCultivation(cultivations, input.calendar)

          const getSoilParam = (param: string) =>
            currentSoilData.find((d) => d.parameter === param)?.value ?? null

          return {
            b_id: f.b_id,
            b_name: f.b_name,
            b_area: f.b_area,
            b_bufferstrip: f.b_bufferstrip,
            b_lu_catalogue: mainLu?.b_lu_catalogue || null,
            b_lu_name: mainLu?.b_lu_name || null,
            b_lu_croprotation: mainLu?.b_lu_croprotation || null,
            b_lu_start: mainLu?.b_lu_start
              ? new Date(mainLu.b_lu_start).toISOString().split("T")[0]
              : null,
            b_soiltype_agr: getSoilParam("b_soiltype_agr"),
            a_clay_mi: getSoilParam("a_clay_mi"),
            a_sand_mi: getSoilParam("a_sand_mi"),
            a_silt_mi: getSoilParam("a_silt_mi"),
            b_gwl_class: getSoilParam("b_gwl_class"),
            a_som_loi: getSoilParam("a_som_loi"),
          }
        }),
      )
      // Must return an object (not array) — Gemini rejects array as top-level function_response.
      return { fields: fieldDetails }
    },
    {
      name: "getFarmFields",
      description:
        "Haal de lijst op van alle percelen die bij het bedrijf horen voor het huidige jaar, inclusief de hoofdteeltgegevens en belangrijkste bodemeigenschappen (landbouwgrondsoort, textuur, grondwaterklasse, organische stof).",
      schema: z.object({
        b_id_farm: z.string().describe("Het ID van het bedrijf"),
        calendar: z.string().describe('Het kalenderjaar (bijv. "2025")'),
      }),
    },
  )

  /**
   * Tool for fetching nutrient advice (N, P, K and others).
   */
  const getFarmNutrientAdviceTool = tool(
    async (input: any, config?: RunnableConfig) => {
      const principalId = config?.configurable?.principalId as PrincipalId | undefined
      if (!principalId) {
        throw new Error("Missing principalId in agent context")
      }
      const calendar =
        (config?.configurable?.calendar as string) || new Date().getFullYear().toString()
      const timeframe = {
        start: new Date(`${calendar}-01-01`),
        end: new Date(`${calendar}-12-31`),
      }

      // nmiApiKey is injected server-side via context state — never exposed to the LLM.
      const nmiApiKey = config?.configurable?.nmiApiKey as string | undefined
      if (!nmiApiKey) {
        throw new Error("Missing nmiApiKey in agent context")
      }
      const args = input as AdviceArgs

      const results = await Promise.all(
        args.b_ids.map(async (b_id) => {
          try {
            const field = await getField(fdm, principalId, b_id)
            const cultivations = await getCultivations(fdm, principalId, b_id, timeframe)
            const mainLu = getMainCultivation(cultivations, calendar)
            const currentSoilData = await getCurrentSoilData(fdm, principalId, b_id)

            if (!mainLu) {
              return { b_id, advice: null }
            }

            if (!isValidDutchCropCatalogue(mainLu.b_lu_catalogue)) {
              return {
                b_id,
                advice: null,
                skipped: `Invalid crop catalogue for NMI nutrient advice: ${mainLu.b_lu_catalogue}`,
              }
            }

            // Skip NMI for fields with no known agricultural crop type.
            // This covers unknown BRP codes (null croprotation) and
            // nature/landscape fields which the NMI API does not support.
            if (!mainLu.b_lu_croprotation || mainLu.b_lu_croprotation === "nature") {
              return {
                b_id,
                advice: null,
                skipped: `Crop type not suitable for NMI nutrient advice: ${mainLu.b_lu_croprotation ?? "unknown"}`,
              }
            }

            const advice = await getNutrientAdvice(fdm, {
              b_lu_catalogue: mainLu.b_lu_catalogue,
              b_centroid: field.b_centroid ?? [0, 0],
              currentSoilData: currentSoilData,
              nmiApiKey,
              b_bufferstrip: field.b_bufferstrip,
            })
            return { b_id, advice }
          } catch (e) {
            return {
              b_id,
              advice: null,
              error: e instanceof Error ? e.message : String(e),
            }
          }
        }),
      )
      // Must return an object (not array) — Gemini rejects array as top-level function_response.
      return { advicePerField: results }
    },
    {
      name: "getFarmNutrientAdvice",
      description:
        "Haal het volledige bemestingsadvies op (N, P, K, Ca, Mg, S, micronutriënten) voor specifieke percelen op basis van bodemmonsters en teeltrotatie.",
      schema: z.object({
        b_ids: z
          .array(z.string())
          .describe("Lijst van perceel-ID's (b_id) om advies voor op te halen"),
      }),
    },
  )

  /**
   * Tool for fetching legal norms (Animal Manure N, Workable N, Phosphate).
   */
  const getFarmLegalNormsTool = tool(
    async (input: any, config?: RunnableConfig) => {
      const principalId = config?.configurable?.principalId as PrincipalId | undefined
      if (!principalId) {
        throw new Error("Missing principalId in agent context")
      }
      const calendar =
        (config?.configurable?.calendar as string) || new Date().getFullYear().toString()

      const normFunctions = createFunctionsForNorms("NL", calendar as any)
      const results = await Promise.all(
        input.b_ids.map(async (b_id: string) => {
          try {
            const normsInput = await normFunctions.collectInputForNorms(fdm, principalId, b_id)
            const [manure, phosphate, nitrogen] = await Promise.all([
              normFunctions.calculateNormForManure(fdm, normsInput as any),
              normFunctions.calculateNormForPhosphate(fdm, normsInput as any),
              normFunctions.calculateNormForNitrogen(fdm, normsInput as any),
            ])
            return {
              b_id,
              norms: {
                animalManureN: manure.normValue,
                workableN: nitrogen.normValue,
                phosphate: phosphate.normValue,
              },
            }
          } catch (e) {
            return {
              b_id,
              norms: null,
              error: e instanceof Error ? e.message : String(e),
            }
          }
        }),
      )
      // Must return an object (not array) — Gemini rejects array as top-level function_response.
      return { normsPerField: results }
    },
    {
      name: "getFarmLegalNorms",
      description:
        "Haal de drie wettelijke grenzen op (dierlijke mest stikstof, werkzame stikstof totaal en fosfaat) voor percelen.",
      schema: z.object({
        b_id_farm: z.string().describe("Het ID van het bedrijf"),
        b_ids: z.array(z.string()).describe("Lijst van perceel-ID's (b_id) om te controleren"),
      }),
    },
  )

  /**
   * Tool for searching fertilizers in the farm inventory.
   */
  const searchFertilizersTool = tool(
    async (input: any, config?: RunnableConfig) => {
      const args = input as SearchArgs
      const principalId = config?.configurable?.principalId as PrincipalId

      if (!fdm || !principalId || !args.b_id_farm) {
        return { fertilizers: [] }
      }

      const farmFertilizers = await getFertilizers(fdm, principalId, args.b_id_farm)
      let results = [...farmFertilizers]

      // Restrict to the user-selected fertilizers if provided (non-empty list only).
      const allowedIds = config?.configurable?.allowedFertilizerCatalogueIds as string[] | undefined
      if (allowedIds && allowedIds.length > 0) {
        results = results.filter((f) => allowedIds.includes(f.p_id_catalogue))
      }

      if (args.p_type) {
        results = results.filter((f) => f.p_type === args.p_type)
      }

      if (args.query) {
        const q = args.query.toLowerCase()
        results = results.filter(
          (f) =>
            f.p_name_nl?.toLowerCase().includes(q) || f.p_id_catalogue?.toLowerCase().includes(q),
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
          p_app_amount_unit: f.p_app_amount_unit,
          p_density: f.p_density,
        })),
      }
    },
    {
      name: "searchFertilizers",
      description:
        "Zoek naar meststofproducten beschikbaar in de bedrijfsvoorraad (inclusief eigen producten) op naam of type.",
      schema: z.object({
        b_id_farm: z.string().describe("Het ID van het bedrijf om de voorraad voor te doorzoeken"),
        query: z.string().optional().describe('Zoekterm (bijv. "varkensdrijfmest", "KAS")'),
        p_type: z
          .enum(["manure", "mineral", "compost"])
          .optional()
          .describe("Filter op meststoftype"),
      }),
    },
  )

  /**
   * Tool for simulating farm plans and checking compliance across all 3 norms and organic matter balance.
   */
  const simulateFarmPlanTool = tool(
    async (input: any, config?: RunnableConfig) => {
      const args = input as SimulationArgs
      const principalId = config?.configurable?.principalId as PrincipalId
      const calendar =
        (config?.configurable?.calendar as string) || new Date().getFullYear().toString()
      const nmiApiKey = config?.configurable?.nmiApiKey as string | undefined

      if (!fdm || !principalId || !args.b_id_farm) {
        throw new Error("Database connection or Farm ID missing")
      }

      const timeframe = {
        start: new Date(`${calendar}-01-01`),
        end: new Date(`${calendar}-12-31`),
      }

      const [omInput, nInput, fertilizers] = await Promise.all([
        collectInputForOrganicMatterBalance(fdm, principalId, args.b_id_farm, timeframe),
        collectInputForNitrogenBalance(fdm, principalId, args.b_id_farm, timeframe),
        getFertilizers(fdm, principalId, args.b_id_farm),
      ])

      const normFuncs = createFunctionsForNorms("NL", calendar as any)
      const fillFuncs = createUncachedFunctionsForFertilizerApplicationFilling(
        "NL",
        calendar as any,
      )

      const fieldResults = await Promise.all(
        args.fields.map(async (fieldData) => {
          try {
            const fieldInfo = await getField(fdm, principalId, fieldData.b_id)

            if (fieldInfo.b_bufferstrip && fieldData.applications.length > 0) {
              return {
                b_id: fieldData.b_id,
                b_area: fieldInfo.b_area,
                error: "Field is a buffer strip and cannot receive fertilizer applications.",
                isValid: false,
                isBufferStripViolation: true,
                fieldMetrics: null,
              }
            }

            // Build properly typed FertilizerApplication objects from proposed
            // applications. Synthetic p_app_id values are used because these
            // applications are not yet persisted in the database.
            const proposedApps = fieldData.applications.map((app, idx) => {
              const fertilizer = fertilizers.find(
                (f: Fertilizer) => f.p_id_catalogue === app.p_id_catalogue,
              )
              if (!fertilizer) {
                throw new Error(`Fertilizer ${app.p_id_catalogue} not found in farm inventory.`)
              }
              const allowedMethods = fertilizer.p_app_method_options ?? []
              if (!app.p_app_method && allowedMethods.length > 0) {
                throw new Error(
                  `Application method is required for ${fertilizer.p_name_nl ?? app.p_id_catalogue}. Allowed methods: ${allowedMethods.join(", ")}.`,
                )
              }
              if (
                app.p_app_method &&
                allowedMethods.length > 0 &&
                !allowedMethods.includes(app.p_app_method as any)
              ) {
                throw new Error(
                  `Invalid application method for ${fertilizer.p_name_nl ?? app.p_id_catalogue}. Allowed methods: ${allowedMethods.join(", ")}.`,
                )
              }
              return {
                p_app_id: `synth-${fieldData.b_id}-${idx}`,
                p_id: fertilizer.p_id,
                p_id_catalogue: app.p_id_catalogue,
                p_app_amount: app.p_app_amount,
                p_app_date: new Date(app.p_app_date),
                p_app_method: app.p_app_method,
              } as unknown as FertilizerApplication
            })

            // Calculate legal norms (phosphate.normValue is required as
            // input to the filling functions).
            const normsInput = await normFuncs.collectInputForNorms(
              fdm,
              principalId,
              fieldData.b_id,
            )
            const [manure, phosphate, nitrogen] = await Promise.all([
              normFuncs.calculateNormForManure(fdm, normsInput as any),
              normFuncs.calculateNormForPhosphate(fdm, normsInput as any),
              normFuncs.calculateNormForNitrogen(fdm, normsInput as any),
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
            const [manureFilling, nitrogenFilling, phosphateFilling] = await Promise.all([
              Promise.resolve(
                fillFuncs.calculateFertilizerApplicationFillingForManure(fillingInput),
              ),
              fillFuncs.calculateFertilizerApplicationFillingForNitrogen(fillingInput),
              Promise.resolve(
                fillFuncs.calculateFertilizerApplicationFillingForPhosphate(fillingInput),
              ),
            ])

            // Calculate organic matter balance using proposed applications.
            const fieldOmInput = omInput.fields.find((f: any) => f.field.b_id === fieldData.b_id)
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
                omBalanceError = e instanceof Error ? e.message : String(e)
              }
            }

            // Calculate nitrogen balance using proposed applications.
            const fieldNInput = nInput.fields.find((f: any) => f.field.b_id === fieldData.b_id)
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
                nBalanceError = e instanceof Error ? e.message : String(e)
              }
            }

            // Calculate nutrient doses from the proposed plan so the agent
            // can compare what the plan provides against the nutrient advice.
            const rawDose = calculateDose({
              applications: proposedApps,
              fertilizers,
            }).dose

            // Fetch nutrient advice so the agent can compare dose vs advice
            // inside a single simulation step without a separate tool call.
            let advice = null
            let adviceSkipped: string | null = null
            if (nmiApiKey && isValidDutchCropCatalogue(fieldData.b_lu_catalogue)) {
              // Fetch the cultivation's crop type to guard against
              // unknown/non-agricultural BRP codes that NMI doesn't support.
              const simCultivations = await getCultivations(
                fdm,
                principalId,
                fieldData.b_id,
                timeframe,
              )
              const simMainLu = getMainCultivation(simCultivations, calendar)
              const croprotation = simMainLu?.b_lu_croprotation

              if (!croprotation || croprotation === "nature") {
                adviceSkipped = `Crop type not suitable for NMI nutrient advice: ${croprotation ?? "unknown"}`
              } else {
                try {
                  const currentSoilData = await getCurrentSoilData(fdm, principalId, fieldData.b_id)
                  advice = await getNutrientAdvice(fdm, {
                    b_lu_catalogue: simMainLu?.b_lu_catalogue ?? "",
                    b_centroid: fieldInfo.b_centroid ?? [0, 0],
                    currentSoilData,
                    nmiApiKey,
                    b_bufferstrip: fieldInfo.b_bufferstrip,
                  })
                } catch {
                  // advice remains null if the fetch fails; not an error
                  adviceSkipped = `Could not fetch NMI nutrient advice for field ${fieldData.b_id}`
                }
              }
            } else if (nmiApiKey && !isValidDutchCropCatalogue(fieldData.b_lu_catalogue)) {
              adviceSkipped = `Invalid crop catalogue for NMI nutrient advice: ${fieldData.b_lu_catalogue}`
            }

            return {
              b_id: fieldData.b_id,
              b_area: fieldInfo.b_area,
              isValid: true,
              fieldMetrics: {
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
                // Proposed nutrient dose (kg/ha) for comparison with
                // nutrient advice. p_dose_nw (workable N) is the correct
                // field to compare against advice.d_n_req — d_n_req
                // expresses the agronomic N requirement in werkzame N.
                // p_dose_n (total N) is included for reference only.
                // p_dose_eoc is omitted as it is not a plant nutrient.
                proposedDose: {
                  p_dose_n: rawDose.p_dose_n,
                  p_dose_nw: rawDose.p_dose_nw,
                  p_dose_p: rawDose.p_dose_p,
                  p_dose_k: rawDose.p_dose_k,
                  p_dose_s: rawDose.p_dose_s,
                  p_dose_mg: rawDose.p_dose_mg,
                  p_dose_ca: rawDose.p_dose_ca,
                  p_dose_na: rawDose.p_dose_na,
                  p_dose_cu: rawDose.p_dose_cu,
                  p_dose_zn: rawDose.p_dose_zn,
                  p_dose_b: rawDose.p_dose_b,
                  p_dose_mn: rawDose.p_dose_mn,
                  p_dose_mo: rawDose.p_dose_mo,
                  p_dose_co: rawDose.p_dose_co,
                },
                omBalance: omBalance?.balance ?? null,
                omBalanceError,
                eomSupplyPerHa: omBalance?.supply?.fertilizers?.total ?? null,
                nBalance: nBalance || null,
                nBalanceError,
                advice,
                adviceSkipped,
              },
            }
          } catch (e) {
            return {
              b_id: fieldData.b_id,
              b_area: null,
              error: e instanceof Error ? e.message : String(e),
              isValid: false,
              fieldMetrics: null,
            }
          }
        }),
      )

      const validFieldResults = fieldResults.filter((r: any) => r.isValid && r.b_area)

      // Compute norms for ALL farm fields.
      const allFarmFields = await getFields(fdm, principalId, args.b_id_farm, timeframe)
      const failedNormFields: string[] = []
      const allFarmFieldNorms = await Promise.all(
        allFarmFields
          .filter((f) => !f.b_bufferstrip && f.b_area)
          .map(async (f) => {
            try {
              const normsInput = await normFuncs.collectInputForNorms(fdm, principalId, f.b_id)
              const [manure, phosphate, nitrogen] = await Promise.all([
                normFuncs.calculateNormForManure(fdm, normsInput as any),
                normFuncs.calculateNormForPhosphate(fdm, normsInput as any),
                normFuncs.calculateNormForNitrogen(fdm, normsInput as any),
              ])
              return {
                b_id: f.b_id,
                b_area: f.b_area as number,
                norms: { manure, phosphate, nitrogen },
              }
            } catch {
              failedNormFields.push(f.b_id)
              return null
            }
          }),
      )

      // Aggregate to farm level using fdm-calculator functions.
      // Norms cover ALL farm fields; fillings cover only the simulated fields.
      const farmNormsKg = aggregateNormsToFarmLevel(
        allFarmFieldNorms
          .filter((r): r is NonNullable<typeof r> => r != null)
          .map((r) => ({
            b_id: r.b_id,
            b_area: r.b_area,
            norms: r.norms,
          })),
      )

      const farmFillingsKg = aggregateNormFillingsToFarmLevel(
        validFieldResults.map((r: any) => ({
          b_id: r.b_id,
          b_area: r.b_area,
          normsFilling: r.fieldMetrics.normsFilling,
        })),
      )

      const farmNBalance = calculateNitrogenBalancesFieldToFarm(
        validFieldResults.map((r: any) => ({
          b_id: r.b_id,
          b_area: r.b_area,
          b_bufferstrip: false,
          balance: r.fieldMetrics.nBalance || undefined,
        })),
        false,
        [],
      )

      const hasBufferStripViolations = fieldResults.some(
        (r: any) => r.isBufferStripViolation === true,
      )

      const complianceIssues: string[] = []
      const agronomicWarnings: string[] = []

      if (failedNormFields.length > 0) {
        agronomicWarnings.push(
          `Normberekening mislukt voor ${failedNormFields.length} perceel(en): [${failedNormFields.join(", ")}]. Normen op bedrijfsniveau kunnen iets te laag zijn weergegeven.`,
        )
      }

      if (hasBufferStripViolations) {
        const bufferFields = fieldResults
          .filter((r: any) => r.isBufferStripViolation === true)
          .map((r: any) => r.b_id)
        complianceIssues.push(
          `Bufferstrook-overtreding: Percelen [${bufferFields.join(", ")}] zijn bufferstroken en mogen geen meststoffen ontvangen.`,
        )
      }

      if (farmFillingsKg.manure > farmNormsKg.manure) {
        const excess = Math.round(farmFillingsKg.manure - farmNormsKg.manure)
        complianceIssues.push(
          `Wettelijke normoverschrijding (Mest-N): Bedrijf overschrijdt de grens met ${excess} kg N. Totaal toegediend: ${farmFillingsKg.manure} kg, Grens: ${farmNormsKg.manure} kg.`,
        )
      }

      if (farmFillingsKg.nitrogen > farmNormsKg.nitrogen) {
        const excess = Math.round(farmFillingsKg.nitrogen - farmNormsKg.nitrogen)
        complianceIssues.push(
          `Wettelijke normoverschrijding (Werkzame N): Bedrijf overschrijdt de grens met ${excess} kg N. Totaal toegediend: ${farmFillingsKg.nitrogen} kg, Grens: ${farmNormsKg.nitrogen} kg.`,
        )
      }

      if (farmFillingsKg.phosphate > farmNormsKg.phosphate) {
        const excess = Math.round(farmFillingsKg.phosphate - farmNormsKg.phosphate)
        complianceIssues.push(
          `Wettelijke normoverschrijding (Fosfaat): Bedrijf overschrijdt de grens met ${excess} kg P2O5. Totaal toegediend: ${farmFillingsKg.phosphate} kg, Grens: ${farmNormsKg.phosphate} kg.`,
        )
      }

      if (args.strategies?.isOrganic) {
        for (const field of args.fields) {
          for (const app of field.applications) {
            const fert = fertilizers.find(
              (f: Fertilizer) => f.p_id_catalogue === app.p_id_catalogue,
            )
            if (fert?.p_type === "mineral") {
              complianceIssues.push(
                `Strategie-overtreding (Biologische teelt): Plan bevat een minerale meststof (${fert.p_id_catalogue} op perceel ${field.b_id}), wat niet is toegestaan.`,
              )
            }
          }
        }
      }

      if (args.strategies?.isDerogation) {
        for (const field of args.fields) {
          for (const app of field.applications) {
            const fert = fertilizers.find(
              (f: Fertilizer) => f.p_id_catalogue === app.p_id_catalogue,
            )
            if (fert?.p_type === "mineral" && fert.p_p_rt != null && fert.p_p_rt > 0) {
              complianceIssues.push(
                `Strategie-overtreding (Derogatie): Plan bevat een minerale meststof met fosfaat (${fert.p_id_catalogue} op perceel ${field.b_id}), wat onder derogatieregels niet is toegestaan.`,
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
          const excess = Math.round(farmNBalance.balance - farmNBalance.target)
          agronomicWarnings.push(
            `Strategiewaarschuwing (Stikstofdoel): De stikstofbalans op bedrijfsniveau (${Math.round(farmNBalance.balance)} kg N/ha) overschrijdt het doel (${Math.round(farmNBalance.target)} kg N/ha) met ${excess} kg N/ha.`,
          )
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
            return (
              a.p_id_catalogue.localeCompare(b.p_id_catalogue) ||
              a.p_app_amount - b.p_app_amount ||
              a.p_app_date.localeCompare(b.p_app_date)
            )
          })

          for (let i = 1; i < fields.length; i++) {
            const currentField = fields[i]
            const currentApps = [...currentField.applications].sort((a, b) => {
              return (
                a.p_id_catalogue.localeCompare(b.p_id_catalogue) ||
                a.p_app_amount - b.p_app_amount ||
                a.p_app_date.localeCompare(b.p_app_date)
              )
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
                `Strategiewaarschuwing (Bouwplanniveau): Perceel ${currentField.b_id} (Gewas: ${currentField.b_lu_name}) heeft andere giften dan andere percelen in dezelfde groep. Voor de strategie "Werken op bouwplanniveau" moeten alle percelen met hetzelfde gewas identieke giften ontvangen.`,
              )
            }
          }
        }
      }

      if (args.strategies?.reduceAmmoniaEmissions) {
        // NH3 emission factor threshold: 0.30 (30 %) separates
        // low-emission methods (injection / incorporation ≤ 0.24) from
        // high-emission methods (broadcasting / spraying ≥ 0.68). The
        // emission value is sourced from the already-computed per-field
        // nitrogen balance (emission.ammonia.fertilizers.total), which
        // internally uses calculateNitrogenEmissionViaAmmoniaByFertilizers.
        const NH3_EMISSION_FACTOR_THRESHOLD = 0.3
        for (const result of fieldResults) {
          if (!result.fieldMetrics?.nBalance) continue
          const nh3FromFertilizers: number =
            result.fieldMetrics.nBalance.emission?.ammonia?.fertilizers?.total ?? 0
          const nFromFertilizers: number =
            result.fieldMetrics.nBalance.supply?.fertilizers?.total ?? 0
          if (nFromFertilizers > 0) {
            // Emission values are negative (losses); supply is positive.
            const avgEmissionFactor = Math.abs(nh3FromFertilizers) / nFromFertilizers
            if (avgEmissionFactor > NH3_EMISSION_FACTOR_THRESHOLD) {
              const fieldData = args.fields.find((f: SimulationField) => f.b_id === result.b_id)
              agronomicWarnings.push(
                `Strategiewaarschuwing (Ammoniakreductie): Perceel ${result.b_id}${fieldData ? ` (${fieldData.b_lu_name})` : ""} heeft een hoge gewogen gemiddelde NH3-emissiefactor (${Math.round(avgEmissionFactor * 100)}%, drempel: ${NH3_EMISSION_FACTOR_THRESHOLD * 100}%). Overweeg emissiearme toedieningsmethoden (bijv. injectie of inwerken) in plaats van breedwerpig strooien of spuiten.`,
              )
            }
          }
        }
      }

      if (args.strategies?.fillManureSpace) {
        if (farmFillingsKg.manure < farmNormsKg.manure * 0.95) {
          // warn if less than 95% full
          const remaining = Math.round(farmNormsKg.manure - farmFillingsKg.manure)
          const nitrogenHeadroom = farmNormsKg.nitrogen - farmFillingsKg.nitrogen
          const phosphateHeadroom = farmNormsKg.phosphate - farmFillingsKg.phosphate
          if (
            nitrogenHeadroom <= farmNormsKg.nitrogen * 0.05 ||
            phosphateHeadroom <= farmNormsKg.phosphate * 0.05
          ) {
            agronomicWarnings.push(
              `Strategiewaarschuwing (Mestruimte vullen): Het bedrijf heeft ongebruikte mestruimte (${remaining} kg N), maar de ruimte voor werkzame N en/of fosfaat is beperkend. Controleer eerst of minerale N met hoge werkzaamheid deels vervangen kan worden door een agronomisch geschikte mest met een lagere p_n_wc, zodat de dierlijke-mestruimte gevuld wordt zonder werkzame N of fosfaat te overschrijden. Als vervanging niet haalbaar is vanwege gewasspecifieke richtlijnen, productbeschikbaarheid of fosfaat, leg die beperking dan uit in plaats van simpelweg mest toe te voegen.`,
            )
          } else {
            agronomicWarnings.push(
              `Strategiewaarschuwing (Mestruimte vullen): Het bedrijf heeft ongebruikte mestruimte (${remaining} kg N beschikbaar). Overweeg meer mest toe te voegen om het gebruik te maximaliseren.`,
            )
          }
        }
      }

      for (const r of validFieldResults) {
        if (r.fieldMetrics?.omBalance && r.fieldMetrics.omBalance < 0) {
          agronomicWarnings.push(
            `Strategiewaarschuwing (Organische stof): Perceel ${r.b_id} heeft een negatieve organische stofbalans (${Math.round(r.fieldMetrics.omBalance)} kg EOS/ha). Overweeg compost of een andere meststof met een hoog EOS-gehalte toe te passen.`,
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
    {
      name: "simulateFarmPlan",
      description:
        "Simuleert een voorgesteld bemestingsplan om de conformiteit met alle 3 wettelijke normen, de organische stofbalans en de stikstofbalans te controleren.",
      schema: z.object({
        b_id_farm: z.string().describe("Het ID van het bedrijf"),
        strategies: z
          .object({
            isOrganic: z.boolean().optional(),
            fillManureSpace: z.boolean().optional(),
            reduceAmmoniaEmissions: z.boolean().optional(),
            keepNitrogenBalanceBelowTarget: z.boolean().optional(),
            workOnRotationLevel: z.boolean().optional(),
            isDerogation: z.boolean().optional(),
          })
          .optional()
          .describe("Door de gebruiker in te stellen strategieën voor waarschuwingen"),
        fields: z
          .array(
            z.object({
              b_id: z.string().describe("Het perceel-ID"),
              b_lu_catalogue: z
                .string()
                .describe("Het gewascatalogus-ID (bijv. nl_265) voor dit perceel"),
              b_lu_name: z.string().describe("De naam van het gewas (bijv. Wintertarwe)"),
              b_lu_start: z.string().describe("De zaai- of startdatum van het gewas (YYYY-MM-DD)"),
              applications: z.array(
                z.object({
                  p_id_catalogue: z.string(),
                  p_app_amount: z.number().describe("Gifthoeveelheid in kg/ha"),
                  p_app_amount_unit: z
                    .string()
                    .optional()
                    .describe("De eenheid van de gifthoeveelheid (bijv. m3/ha, kg/ha, l/ha, t/ha)"),
                  p_app_amount_display: z
                    .number()
                    .optional()
                    .describe(
                      "De numerieke gifthoeveelheid (de eenheid staat apart in p_app_amount_unit)",
                    ),
                  p_app_date: z.string().describe("Toedieningsdatum in formaat YYYY-MM-DD"),
                  p_app_method: z.string().optional(),
                }),
              ),
            }),
          )
          .describe("Voorgestelde giften per perceel"),
      }),
    },
  )

  /**
   * Tool for loading crop-specific fertilizer preferences from the skill reference files.
   * Returns guidance for the crops present on the farm, loaded from individual per-crop
   * markdown files so only relevant content is returned.
   */
  const getCropFertilizerGuideTool = tool(
    async (rawInput: { b_lu_catalogues: string[] }) => {
      const input = rawInput
      const catalogues = input.b_lu_catalogues.filter(Boolean)
      const currentDir = dirname(fileURLToPath(import.meta.url))
      // Resolve the skills base path — works for both bundled dist and source/test.
      const distPath = join(currentDir, "skills", "crop-specific-fertilizer-preferences")
      const srcPath = join(currentDir, "..", "..", "skills", "crop-specific-fertilizer-preferences")
      const skillBase = existsSync(distPath) ? distPath : srcPath

      const indexPath = join(skillBase, "assets", "crop-index.json")
      let cropIndex: Record<string, string>
      try {
        cropIndex = JSON.parse(readFileSync(indexPath, "utf-8"))
      } catch {
        return {
          guide: "Geen gewasspecifieke bemestingsrichtlijnen beschikbaar (index niet gevonden).",
          matchedCrops: [],
        }
      }

      // Deduplicate filenames so each guide file is loaded at most once.
      const filesToLoad = new Set<string>()
      for (const code of catalogues) {
        const file = cropIndex[code]
        if (file) filesToLoad.add(file)
      }

      if (filesToLoad.size === 0) {
        return {
          guide:
            "Geen gewasspecifieke bemestingsrichtlijnen gevonden voor de opgegeven gewascodes.",
          matchedCrops: [],
        }
      }

      const sections: string[] = []
      for (const file of filesToLoad) {
        const filePath = join(skillBase, "references", file)
        if (existsSync(filePath)) {
          sections.push(readFileSync(filePath, "utf-8"))
        }
      }

      return {
        guide: sections.join("\n\n---\n\n"),
        matchedCrops: [...filesToLoad],
      }
    },
    {
      name: "getCropFertilizerGuide",
      description:
        "Laad de gewasspecifieke bemestingsvoorkeuren en -beperkingen voor de gewassen op dit bedrijf. Roep dit één keer aan na getFarmFields en geef alle unieke b_lu_catalogue-waarden op die op het bedrijf voorkomen. Geeft agronomische regels (gewenste producten, gedeelde timing, te vermijden nutriënten) per gewasgroep terug.",
      schema: z.object({
        b_lu_catalogues: z
          .array(z.string())
          .describe(
            "Lijst van unieke gewascataloguscodes die op het bedrijf voorkomen (bijv. ['nl_2014', 'nl_259', 'nl_265'])",
          ),
      }),
    },
  )

  return [
    getFarmFieldsTool,
    getFarmNutrientAdviceTool,
    getFarmLegalNormsTool,
    searchFertilizersTool,
    simulateFarmPlanTool,
    getCropFertilizerGuideTool,
  ]
}

/**
 * Returns the planner tool subset safe for the clarify agent:
 * all tools except simulateFarmPlan (which is plan-execution, not investigation).
 */
export function createClarifyAgentTools(fdm: FdmType) {
  return createFertilizerPlannerTools(fdm).filter((t) => (t as any).name !== "simulateFarmPlan")
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
    isDerogation?: boolean
  }
  fields: SimulationField[]
}
