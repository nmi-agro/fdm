import {
  aggregateNormFillingsToFarmLevel,
  aggregateNutrientAdviceToFarmLevel,
  aggregateNormsToFarmLevel,
  calculateDose,
  calculateNormFillingsForFields,
  calculateNormsForFields,
  fdmCalculator,
  type GebruiksnormResult,
  getMainCultivation,
  getNutrientAdvice,
  getOrganicMatterBalanceField,
  getYearTimeframe,
  isNormsYear,
  NormFilling,
} from "@nmi-agro/fdm-calculator"
import {
  type CachedCalculation,
  type CachedCalculationManyOptions,
  type FdmType,
  getCultivationsForFarm,
  getCultivationsFromCatalogue,
  getCurrentSoilDataForFarm,
  getFarm,
  getFertilizerApplicationsForFarm,
  getFertilizers,
  getFields,
  getGrazingIntention,
  isDerogationGrantedForYear,
  isOrganicCertificationValid,
} from "@nmi-agro/fdm-core"
import { generateCalculationHash } from "@nmi-agro/fdm-core"
import { format } from "date-fns"
import { nl } from "date-fns/locale"
import type { FertilizerPlanData, ReportBranding } from "./types"
import pkg from "../package"

/** Norm values of a field, as calculated for the fertilizer plan. */
type FieldNormValues = {
  manure: GebruiksnormResult
  phosphate: GebruiksnormResult
  nitrogen: GebruiksnormResult
  renure?: GebruiksnormResult
}

/** Norm fillings of a field, as calculated for the fertilizer plan. */
type FieldNormFillings = {
  manure: NormFilling
  phosphate: NormFilling
  nitrogen: NormFilling
  renure?: NormFilling
}

/**
 * Returns the timeframe of a calendar year in the Europe/Amsterdam time zone, the same
 * timeframe that fdm-app uses for a calendar year.
 *
 * @param year - The calendar year.
 * @returns Start (1 January 00:00) and end (31 December 23:59:59.999) of the year.
 */
export function getCalendarYearTimeframe(year: number): { start: Date; end: Date } {
  return getYearTimeframe(year) as { start: Date; end: Date }
}

function formatDate(date: Date | string | number | undefined): string {
  if (!date) return "-"
  return format(date, "d MMM", { locale: nl })
}

const DEROGATION_GRANTED_NEEDED_FOR_YEARS = [2025]

/** Maximum number of nutrient advice requests to the NMI API at the same time. */
const NUTRIENT_ADVICE_CONCURRENCY = 10

/**
 * Runs a cached calculation for the fields that have an input, with one cache lookup for all
 * of them.
 *
 * @returns The outcome per field, in the order of `inputs`; `undefined` for a field without input.
 */
async function settleForFields<T_Input extends object, T_Output>(
  fdm: FdmType,
  calculation: CachedCalculation<T_Input, T_Output>,
  inputs: (T_Input | undefined)[],
  options?: CachedCalculationManyOptions,
): Promise<(PromiseSettledResult<T_Output> | undefined)[]> {
  const requested = inputs.flatMap((input, index) => (input ? [{ input, index }] : []))
  const settled = await Promise.allSettled(
    calculation.many(
      fdm,
      requested.map(({ input }) => input),
      options,
    ),
  )
  const results: (PromiseSettledResult<T_Output> | undefined)[] = inputs.map(() => undefined)
  for (const [i, { index }] of requested.entries()) {
    results[index] = settled[i]
  }
  return results
}

/**
 * Collects all data a fertilizer plan of a farm is based on: the farm, its fields with their
 * cultivations, fertilizer applications and soil data, the catalogues, and the derogation,
 * organic certification and grazing intention of the year.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - The principal requesting the plan. Needs read access to the farm.
 * @param b_id_farm - The farm.
 * @param year - Calendar year of the plan.
 * @returns The input data of the plan.
 */
export async function collectFertilizerPlanInput(
  fdm: FdmType,
  principal_id: string,
  b_id_farm: string,
  year: number,
) {
  const timeframe = getCalendarYearTimeframe(year)

  const [
    farm,
    fields,
    cultivationsCatalogue,
    fertilizersCatalogue,
    cultivationsMap,
    fertilizerApplicationsMap,
    currentSoilDataMap,
    derogationGranted,
    has_organic_certification,
    has_grazing_intention,
  ] = await Promise.all([
    getFarm(fdm, principal_id, b_id_farm),
    getFields(fdm, principal_id, b_id_farm, timeframe),
    getCultivationsFromCatalogue(fdm, principal_id, b_id_farm),
    getFertilizers(fdm, principal_id, b_id_farm),
    getCultivationsForFarm(fdm, principal_id, b_id_farm, timeframe),
    getFertilizerApplicationsForFarm(fdm, principal_id, b_id_farm, timeframe),
    getCurrentSoilDataForFarm(fdm, principal_id, b_id_farm, timeframe),
    DEROGATION_GRANTED_NEEDED_FOR_YEARS.includes(year)
      ? isDerogationGrantedForYear(fdm, principal_id, b_id_farm, year)
      : null,
    isOrganicCertificationValid(
      fdm,
      principal_id,
      b_id_farm,
      new Date(year, 4, 15), // May 15th of the specified year
    ),
    getGrazingIntention(fdm, principal_id, b_id_farm, year),
  ])

  // `config` is not part of this since it is purely stylistic and it doesn't affect the contemporary data
  return {
    year: year,
    farm: farm,
    fields: fields.map((field) => ({
      ...field,
      fertilizerApplications: fertilizerApplicationsMap.get(field.b_id) ?? [],
      cultivations: cultivationsMap.get(field.b_id) ?? [],
      currentSoilData: currentSoilDataMap.get(field.b_id) ?? [],
    })),
    fertilizersCatalogue: fertilizersCatalogue,
    cultivationsCatalogue: cultivationsCatalogue,
    derogationGranted: derogationGranted,
    has_organic_certification: has_organic_certification,
    has_grazing_intention: has_grazing_intention,
  }
}

/**
 * Computes a hash of the input data of a fertilizer plan. A saved plan is up to date when the
 * hash of the current input equals the hash stored with the plan. The hash includes the versions
 * of `fdm-reports` and `fdm-calculator`, so a new calculation method marks plans as outdated.
 *
 * @param input - The input data from {@link collectFertilizerPlanInput}.
 * @returns The hash.
 */
export function getFertilizerPlanInputHash(input: FertilizerPlanInput): string {
  return generateCalculationHash(
    "computeBemestingsplan",
    `fdm-reports:${pkg.version}|${fdmCalculator.calculatorVersion}`,
    input,
  )
}

/** The input data of a fertilizer plan, as collected from the database. */
export type FertilizerPlanInput = Awaited<ReturnType<typeof collectFertilizerPlanInput>>

/** Options for {@link computeFertilizerPlanData}. */
export interface ComputeFertilizerPlanOptions {
  /** NMI API key used for the nutrient advice. Without it, fields get no advice. */
  nmiApiKey: string | undefined
  /** Name, logos and cover image shown in the PDF. */
  branding: ReportBranding
}

/**
 * Calculates the content of a fertilizer plan: usage norms and their filling, nutrient advice,
 * planned doses and the organic matter balance, per field and for the farm.
 *
 * @param fdm - The FDM instance.
 * @param input - The input data from {@link collectFertilizerPlanInput}.
 * @param options - NMI API key and branding.
 * @returns The data shown in the PDF.
 */
export async function computeFertilizerPlanData(
  fdm: FdmType,
  {
    year,
    farm,
    fields,
    fertilizersCatalogue,
    cultivationsCatalogue,
    derogationGranted,
    has_organic_certification,
    has_grazing_intention,
  }: FertilizerPlanInput,
  options: ComputeFertilizerPlanOptions,
): Promise<FertilizerPlanData> {
  const pdfFieldsData: FertilizerPlanData["fields"] = []

  const timeframe = getCalendarYearTimeframe(year)
  const yearStr = String(year)
  const normYear = isNormsYear(yearStr) ? yearStr : undefined

  // The inputs of the cached calculations per field
  const prepareField = (fieldExtended: (typeof fields)[number]) => {
    const { fertilizerApplications, cultivations, currentSoilData, ...field } = fieldExtended
    const mainCultivation = getMainCultivation(cultivations, year)
    return {
      inputsError: undefined as unknown,
      fieldExtended,
      field,
      fertilizerApplications,
      cultivations,
      currentSoilData,
      mainCultivation,
      normInput: {
        farm: {
          ...((derogationGranted === null
            ? {}
            : { is_derogatie_bedrijf: derogationGranted }) as any),
          has_grazing_intention: has_grazing_intention,
        },
        field: field,
        cultivations: cultivations,
        soilAnalysis: {
          a_p_cc: currentSoilData.find((x: { parameter: string }) => x.parameter === "a_p_cc")
            ?.value as number | null,
          a_p_al: currentSoilData.find((x: { parameter: string }) => x.parameter === "a_p_al")
            ?.value as number | null,
        },
      },
      adviceInput: mainCultivation
        ? {
            b_lu_catalogue: mainCultivation.b_lu_catalogue,
            b_centroid: field.b_centroid,
            currentSoilData: currentSoilData,
            nmiApiKey: options.nmiApiKey,
            b_bufferstrip: field.b_bufferstrip,
          }
        : undefined,
      omInput: {
        fieldInput: {
          field: field,
          cultivations: cultivations,
          currentSoilData: currentSoilData,
          fertilizerApplications: fertilizerApplications,
        },
        fertilizerDetails: fertilizersCatalogue,
        cultivationDetails: cultivationsCatalogue,
        timeFrame: timeframe,
      },
    }
  }
  // A field whose inputs cannot be built gets an error row, like a field whose calculation fails
  const prepared = fields.map((fieldExtended) => {
    try {
      return prepareField(fieldExtended)
    } catch (error) {
      const { fertilizerApplications, cultivations, currentSoilData, ...field } = fieldExtended
      return {
        inputsError: error,
        fieldExtended,
        field,
        fertilizerApplications,
        cultivations,
        currentSoilData,
        mainCultivation: undefined,
        normInput: undefined,
        adviceInput: undefined,
        omInput: undefined,
      }
    }
  })

  // Each cached calculation looks up all fields in the cache with one query. The norms come
  // first, because the fillings need the phosphate norm. A field whose norms fail gets an error
  // row, so its other calculations are skipped.
  const norms = normYear
    ? await calculateNormsForFields(
        fdm,
        "NL",
        normYear,
        prepared.map((p) => p.normInput),
      )
    : undefined
  const isCalculated = (index: number) => {
    if (prepared[index].inputsError) return false
    const normResult = norms?.[index]
    return !norms || (normResult !== undefined && "values" in normResult)
  }
  const [fillings, advices, omBalances] = await Promise.all([
    normYear
      ? calculateNormFillingsForFields(
          fdm,
          "NL",
          normYear,
          prepared.map((p, index) => {
            const normResult = norms?.[index]
            if (!normResult || !("values" in normResult)) return undefined
            return {
              cultivations: p.cultivations,
              applications: p.fertilizerApplications,
              fertilizers: fertilizersCatalogue,
              has_organic_certification: has_organic_certification,
              has_grazing_intention: has_grazing_intention,
              fosfaatgebruiksnorm: normResult.values.phosphate.normValue,
              b_centroid: p.field.b_centroid,
            }
          }),
        )
      : undefined,
    settleForFields(
      fdm,
      getNutrientAdvice,
      prepared.map((p, index) => (isCalculated(index) ? p.adviceInput : undefined)),
      { concurrency: NUTRIENT_ADVICE_CONCURRENCY },
    ),
    settleForFields(
      fdm,
      getOrganicMatterBalanceField,
      prepared.map((p, index) => (isCalculated(index) ? p.omInput : undefined)),
    ),
  ])

  for (const [index, prepare] of prepared.entries()) {
    const { fieldExtended, field, fertilizerApplications, cultivations, currentSoilData } = prepare
    try {
      if (prepare.inputsError) throw prepare.inputsError
      // Main cultivation
      const mainCultivation = prepare.mainCultivation
      const catchCrop = mainCultivation
        ? cultivations.find((c) => c.b_lu !== mainCultivation.b_lu)
        : undefined

      // Soil parameters
      const soilParams: Record<string, any> = {}
      let samplingDate: Date | undefined
      if (Array.isArray(currentSoilData)) {
        for (const item of currentSoilData) {
          soilParams[item.parameter] = item.value
          for (const source of item.sources) {
            if (
              source.b_sampling_date &&
              (!samplingDate || source.b_sampling_date > samplingDate)
            ) {
              samplingDate = source.b_sampling_date
            }
          }
        }
      }

      // Norms; a failing norm or filling is handled by the catch below
      let normsResult: { value: FieldNormValues; filling: FieldNormFillings } | undefined
      if (norms) {
        const normResult = norms[index]
        if (!normResult) throw new Error("Norms were not calculated")
        if ("error" in normResult) throw normResult.error
        const fillingResult = fillings?.[index]
        if (!fillingResult) throw new Error("Norm filling was not calculated")
        if ("error" in fillingResult) throw fillingResult.error
        normsResult = { value: normResult.values, filling: fillingResult.values }
      }

      // Nutrient advice
      let adviceKgHa = {
        d_n_req: 0,
        d_p_req: 0,
        d_k_req: 0,
        d_mg_req: 0,
        d_s_req: 0,
        d_c_req: 0,
        d_ca_req: 0,
        d_na_req: 0,
        d_cu_req: 0,
        d_zn_req: 0,
        d_co_req: 0,
        d_mn_req: 0,
        d_mo_req: 0,
        d_b_req: 0,
      }
      const adviceResult = advices[index]
      if (adviceResult?.status === "rejected") {
        console.error(`Failed to get nutrient advice for field ${field.b_id}:`, adviceResult.reason)
      } else if (adviceResult?.value) {
        const result = adviceResult.value
        adviceKgHa = {
          d_n_req: result.d_n_req || 0,
          d_p_req: result.d_p_req || 0,
          d_k_req: result.d_k_req || 0,
          d_mg_req: result.d_mg_req || 0,
          d_s_req: result.d_s_req || 0,
          d_c_req: result.d_c_req || 0,
          d_ca_req: result.d_ca_req || 0,
          d_na_req: result.d_na_req || 0,
          d_cu_req: result.d_cu_req || 0,
          d_zn_req: result.d_zn_req || 0,
          d_co_req: result.d_co_req || 0,
          d_mn_req: result.d_mn_req || 0,
          d_mo_req: result.d_mo_req || 0,
          d_b_req: result.d_b_req || 0,
        }
      }

      // Calculate Doses (Planned)
      const { dose: plannedDose, applications: plannedApplicationDoses } = calculateDose({
        applications: fertilizerApplications,
        fertilizers: fertilizersCatalogue,
      })

      // Organic matter balance; a failure is handled by the catch below
      const omResult = omBalances[index]
      if (!omResult) throw new Error("Organic matter balance was not calculated")
      if (omResult.status === "rejected") throw omResult.reason
      const omBalanceResult = omResult.value

      const fieldData: (typeof pdfFieldsData)[number] = {
        id: field.b_id,
        name: field.b_name,
        area: field.b_area || 0,
        isBufferstrip: field.b_bufferstrip,
        mainCrop: mainCultivation?.b_lu_name || "Geen gewas",
        catchCrop: catchCrop?.b_lu_name,
        soil: {
          b_sampling_date: formatDate(samplingDate),
          a_ph_cc: soilParams.a_ph_cc,
          a_p_al: soilParams.a_p_al,
          a_p_cc: soilParams.a_p_cc,
          a_k_cc: soilParams.a_k_cc,
          a_som_loi: soilParams.a_som_loi,
          b_soiltype_agr: soilParams.b_soiltype_agr,
          a_clay_mi: soilParams.a_clay_mi,
          a_sand_mi: soilParams.a_sand_mi,
          a_silt_mi: soilParams.a_silt_mi,
        },
        norms: normsResult
          ? {
              nitrogen: normsResult.value.nitrogen.normValue,
              manure: normsResult.value.manure.normValue,
              phosphate: normsResult.value.phosphate.normValue,
              renure: normsResult.value.renure?.normValue,
            }
          : { nitrogen: 0, manure: 0, phosphate: 0, renure: 0 },
        normsFilling: normsResult
          ? {
              nitrogen: normsResult.filling.nitrogen.normFilling,
              manure: normsResult.filling.manure.normFilling,
              phosphate: normsResult.filling.phosphate.normFilling,
              renure: normsResult.filling.renure?.normFilling,
            }
          : { nitrogen: 0, manure: 0, phosphate: 0 },
        advice: adviceKgHa,
        planned: plannedDose,
        omBalance: omBalanceResult
          ? {
              balance: omBalanceResult.balance,
              supply: omBalanceResult.supply.total,
              supplyManure: omBalanceResult.supply.fertilizers.manure.total,
              supplyCompost: omBalanceResult.supply.fertilizers.compost.total,
              supplyCultivations: omBalanceResult.supply.cultivations.total,
              supplyResidues: omBalanceResult.supply.residues.total,
              degradation: omBalanceResult.degradation.total,
            }
          : undefined,
        applications: plannedApplicationDoses.map((plannedApp) => {
          const appDose = plannedApp ?? {
            p_dose_n: 0,
            p_dose_nw: 0,
            p_dose_p: 0,
            p_dose_k: 0,
            p_dose_eoc: 0,
            p_dose_mg: 0,
            p_dose_s: 0,
            p_dose_ca: 0,
            p_dose_na: 0,
            p_dose_cu: 0,
            p_dose_zn: 0,
            p_dose_co: 0,
            p_dose_mn: 0,
            p_dose_mo: 0,
            p_dose_b: 0,
          }
          const app = appDose.p_app_id
            ? fertilizerApplications.find((p_app) => p_app.p_app_id === appDose.p_app_id)
            : undefined
          const fert = app ? fertilizersCatalogue.find((f) => f.p_id === app.p_id) : undefined

          return {
            date: formatDate(app?.p_app_date),
            product: fert?.p_name_nl ?? app?.p_id ?? "onbekend",
            quantity: app?.p_app_amount ?? 0,
            quantity_display: app?.p_app_amount_display ?? 0,
            quantity_unit: app?.p_app_amount_unit ?? "kg/ha",
            p_dose_n: appDose.p_dose_n || 0,
            p_dose_nw: appDose.p_dose_nw || 0,
            p_dose_p: appDose.p_dose_p || 0,
            p_dose_k: appDose.p_dose_k || 0,
            p_dose_eoc: appDose.p_dose_eoc || 0,
            p_dose_mg: appDose.p_dose_mg || 0,
            p_dose_s: appDose.p_dose_s || 0,
            p_dose_ca: appDose.p_dose_ca || 0,
            p_dose_na: appDose.p_dose_na || 0,
            p_dose_cu: appDose.p_dose_cu || 0,
            p_dose_zn: appDose.p_dose_zn || 0,
            p_dose_co: appDose.p_dose_co || 0,
            p_dose_mn: appDose.p_dose_mn || 0,
            p_dose_mo: appDose.p_dose_mo || 0,
            p_dose_b: appDose.p_dose_b || 0,
          }
        }),
      }

      pdfFieldsData.push(fieldData)
    } catch (error) {
      console.error(`Error processing field ${fieldExtended.b_id}:`, error)
      pdfFieldsData.push({
        id: field.b_id,
        name: field.b_name,
        area: field.b_area || 0,
        isBufferstrip: field.b_bufferstrip,
        mainCrop: "Fout bij laden",
        soil: {},
        norms: { nitrogen: 0, manure: 0, phosphate: 0 },
        normsFilling: { nitrogen: 0, manure: 0, phosphate: 0 },
        advice: {
          d_n_req: 0,
          d_p_req: 0,
          d_k_req: 0,
          d_mg_req: 0,
          d_s_req: 0,
          d_c_req: 0,
          d_ca_req: 0,
          d_na_req: 0,
          d_cu_req: 0,
          d_zn_req: 0,
          d_co_req: 0,
          d_mn_req: 0,
          d_mo_req: 0,
          d_b_req: 0,
        },
        planned: {
          p_dose_n: 0,
          p_dose_nw: 0,
          p_dose_p: 0,
          p_dose_k: 0,
          p_dose_eoc: 0,
          p_dose_mg: 0,
          p_dose_s: 0,
          p_dose_ca: 0,
          p_dose_na: 0,
          p_dose_cu: 0,
          p_dose_zn: 0,
          p_dose_co: 0,
          p_dose_mn: 0,
          p_dose_mo: 0,
          p_dose_b: 0,
        },
        applications: [],
      })
    }
  }

  // Aggregates for farm level (Total kg)
  const totalArea = fields.reduce((acc, f) => acc + (f.b_area || 0), 0)
  const productiveArea = fields.reduce((acc, f) => acc + (f.b_bufferstrip ? 0 : f.b_area || 0), 0)

  // Correctly aggregate norms and fillings using calculator functions
  const totalNormsKg = aggregateNormsToFarmLevel(
    pdfFieldsData.map((f) => ({
      b_id: f.id,
      b_area: f.area,
      norms: {
        manure: { normValue: f.norms.manure, normSource: "" },
        nitrogen: { normValue: f.norms.nitrogen, normSource: "" },
        phosphate: { normValue: f.norms.phosphate, normSource: "" },
        renure: f.norms.renure ? { normValue: f.norms.renure, normSource: "" } : undefined,
      },
    })),
  )

  const totalNormsFillingKg = aggregateNormFillingsToFarmLevel(
    pdfFieldsData.map((f) => ({
      b_id: f.id,
      b_area: f.area,
      normsFilling: {
        manure: {
          normFilling: f.normsFilling?.manure || 0,
          applicationFilling: [],
        },
        nitrogen: {
          normFilling: f.normsFilling?.nitrogen || 0,
          applicationFilling: [],
        },
        phosphate: {
          normFilling: f.normsFilling?.phosphate || 0,
          applicationFilling: [],
        },
        renure:
          typeof f.normsFilling?.renure === "number"
            ? {
                normFilling: f.normsFilling.renure,
                applicationFilling: [],
              }
            : undefined,
      },
    })),
  )

  // Total advice and planned dose in kg. Both total N and workable N are compared with the N advice.
  const totalAdviceAndDoseKg = aggregateNutrientAdviceToFarmLevel(
    pdfFieldsData.map((f) => ({
      b_area: f.area,
      values: {
        n: { dose: f.planned.p_dose_n, advice: f.advice.d_n_req },
        nw: { dose: f.planned.p_dose_nw, advice: f.advice.d_n_req },
        p: { dose: f.planned.p_dose_p, advice: f.advice.d_p_req },
        k: { dose: f.planned.p_dose_k, advice: f.advice.d_k_req },
        eoc: { dose: f.planned.p_dose_eoc, advice: f.advice.d_c_req },
      },
    })),
    ["n", "nw", "p", "k", "eoc"],
    "total",
  )

  const totalAdviceKg = {
    d_n_req: totalAdviceAndDoseKg.n.advice,
    d_p_req: totalAdviceAndDoseKg.p.advice,
    d_k_req: totalAdviceAndDoseKg.k.advice,
    d_c_req: totalAdviceAndDoseKg.eoc.advice,
  }

  const totalPlannedUsageKg = {
    p_dose_n: totalAdviceAndDoseKg.n.dose,
    p_dose_nw: totalAdviceAndDoseKg.nw.dose,
    p_dose_p: totalAdviceAndDoseKg.p.dose,
    p_dose_k: totalAdviceAndDoseKg.k.dose,
    p_dose_eoc: totalAdviceAndDoseKg.eoc.dose,
  }

  // Calculate aggregate OM balance (weighted average per ha)
  const totalOmBalance =
    totalArea > 0
      ? pdfFieldsData.reduce(
          (acc, f) => {
            if (f.omBalance) {
              return {
                balance: acc.balance + f.omBalance.balance * f.area,
                supply: acc.supply + f.omBalance.supply * f.area,
                degradation: acc.degradation + f.omBalance.degradation * f.area,
              }
            }
            return acc
          },
          { balance: 0, supply: 0, degradation: 0 },
        )
      : { balance: 0, supply: 0, degradation: 0 }

  const farmOmBalance = {
    balance: totalArea > 0 ? totalOmBalance.balance / totalArea : 0,
    supply: totalArea > 0 ? totalOmBalance.supply / totalArea : 0,
    degradation: totalArea > 0 ? totalOmBalance.degradation / totalArea : 0,
  }

  const data = {
    generatedAt: new Date().toISOString(),
    config: options.branding,
    farm: {
      name: farm.b_name_farm || "Onbekend",
      kvk: farm.b_businessid_farm || undefined,
    },
    year: String(year),
    totalArea: totalArea,
    productiveArea: productiveArea,
    norms: totalNormsKg,
    normsFilling: totalNormsFillingKg,
    totalAdvice: totalAdviceKg,
    plannedUsage: totalPlannedUsageKg,
    omBalance: farmOmBalance,
    fields: pdfFieldsData,
  }

  return data
}
