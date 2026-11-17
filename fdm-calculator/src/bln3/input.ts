import type {
  Cultivation,
  FdmType,
  FertilizerApplication,
  Field,
  fdmSchema,
  Measure,
  PrincipalId,
  SoilAnalysis,
  Timeframe,
} from "@nmi-agro/fdm-core"
import {
  getCultivations,
  getCultivationsForFarm,
  getFertilizerApplications,
  getFertilizerApplicationsForFarm,
  getField,
  getFields,
  getMeasures,
  getMeasuresForFarm,
  getSoilAnalyses,
  getSoilAnalysesForFarm,
} from "@nmi-agro/fdm-core"
import type {
  Bln3Cultivation,
  Bln3Measure,
  Bln3MeasureApplicabilityCollectedInputs,
  Bln3ScoreCollectedInputs,
} from "./types"
import { type CultivationForHoofdteelt, findHoofdteelt } from "../shared/hoofdteelt"
import { getBln3ExclusionReason } from "./exclusion"

/** A timeframe shorter than this covers a single calendar year. */
const MAX_SINGLE_YEAR_MS = 366 * 24 * 60 * 60 * 1000

/** Numeric lab parameters taken from the latest soil analysis that has a value for them. */
const LAB_NUMERIC_FIELDS = [
  "a_ca_co_po",
  "a_cec_co",
  "a_clay_mi",
  "a_cn_fr",
  "a_k_cc",
  "a_k_co_po",
  "a_mg_cc",
  "a_mg_co_po",
  "a_n_pmn",
  "a_n_rt",
  "a_p_al",
  "a_p_cc",
  "a_p_wa",
  "a_ph_cc",
  "a_s_rt",
  "a_sand_mi",
  "a_silt_mi",
  "a_som_loi",
] as const

/** Numeric BodemConditieScore parameters, used for the BLN3 score only. */
const BCS_NUMERIC_FIELDS = [
  "a_ss_bcs",
  "a_sc_bcs",
  "a_rd_bcs",
  "a_ew_bcs",
  "a_cc_bcs",
  "a_gs_bcs",
  "a_p_bcs",
  "a_c_bcs",
  "a_rt_bcs",
] as const

/** The field properties needed for the BLN3 inputs. */
type Bln3Field = Pick<Field, "b_centroid" | "b_bufferstrip">

/**
 * Resolves the calendar year a BLN3 score is calculated for.
 *
 * A timeframe of one calendar year (or with only an end date) gives the year of its end.
 * A longer timeframe, or none, gives the latest year with a main cultivation, up to the end
 * of the timeframe (without a timeframe: up to the current year or the latest cultivation).
 * When no year has a main cultivation, the end year of the timeframe or the current year is
 * returned, so the field is excluded for lack of a main cultivation.
 *
 * @param cultivations - All cultivations of the field.
 * @param timeframe - Optional timeframe of the request.
 * @returns The calendar year of the score.
 */
function resolveBln3ScoreYear(
  cultivations: CultivationForHoofdteelt[],
  timeframe?: Timeframe,
): number {
  const endYear = timeframe?.end?.getFullYear()
  if (
    timeframe?.end &&
    (!timeframe.start || timeframe.end.getTime() - timeframe.start.getTime() < MAX_SINGLE_YEAR_MS)
  ) {
    return timeframe.end.getFullYear()
  }

  const startYears = cultivations
    .map((c) => c.b_lu_start?.getFullYear())
    .filter((y): y is number => y !== undefined)
  const coveredYears = cultivations
    .map((c) => c.b_lu_end?.getFullYear() ?? c.b_lu_start?.getFullYear())
    .filter((y): y is number => y !== undefined)
  const currentYear = new Date().getFullYear()
  const upperYear = endYear ?? Math.max(currentYear, ...coveredYears)
  const lowerYear = startYears.length > 0 ? Math.min(...startYears) : upperYear

  for (let year = upperYear; year >= lowerYear; year--) {
    if (findHoofdteelt(cultivations, year, true)) return year
  }
  return endYear ?? currentYear
}

/**
 * Picks, for each numeric parameter, the value of the most recent soil analysis that has one.
 *
 * Lab and BCS analyses are stored as separate records, so the latest analysis alone may lack
 * some parameters. fdm-core sorts soil analyses by `b_sampling_date DESC NULLS LAST`; NMI
 * BodemSchat estimates have no sampling date, so they are only used when no lab value exists.
 */
function selectLatestSoilValues(
  soilAnalyses: SoilAnalysis[],
  parameters: readonly (keyof SoilAnalysis)[],
): Record<string, number> {
  const soilData: Record<string, number> = {}
  for (const parameter of parameters) {
    const analysis = soilAnalyses.find((a) => typeof a[parameter] === "number")
    if (analysis) {
      soilData[parameter] = analysis[parameter] as number
    }
  }
  return soilData
}

/**
 * Builds the cultivation history with the Dutch "hoofdteelt" rule (May 15–July 15).
 *
 * Only years within the span of known cultivation data are processed, from the latest year
 * (the end of the timeframe, if later) back to the first. Years in that span without a
 * cultivation in the window receive groene braak (nl_6794). Cultivations without `b_lu_start`
 * are excluded from the range calculation.
 */
function buildBln3CultivationHistory(
  cultivations: Cultivation[],
  timeframe?: Timeframe,
): Bln3Cultivation[] {
  const cultivationsWithStart = cultivations.filter((c) => c.b_lu_start != null)
  const bln3Cultivations: Bln3Cultivation[] = []
  if (cultivationsWithStart.length === 0) return bln3Cultivations

  // maxYear: timeframe end year takes precedence; otherwise the latest
  // year covered by any cultivation (end date or start date).
  const cultivationMaxYear = cultivationsWithStart.reduce((max, c) => {
    const y = c.b_lu_end?.getFullYear() ?? c.b_lu_start?.getFullYear()
    return y !== undefined && y > max ? y : max
  }, 0)
  const maxYear = Math.max(timeframe?.end?.getFullYear() ?? 0, cultivationMaxYear)
  const minYear = cultivationsWithStart.reduce((min, c) => {
    const y = c.b_lu_start?.getFullYear()
    return y !== undefined && y < min ? y : min
  }, maxYear)

  for (let year = maxYear; year >= minYear; year--) {
    const hoofdteelt = findHoofdteelt(cultivations, year)
    const match = /^nl_(\d+)$/.exec(hoofdteelt.b_lu_catalogue)
    if (!match) continue
    bln3Cultivations.push({
      b_lu_brp: Number(match[1]),
      b_lu_year: year,
    })
  }
  return bln3Cultivations
}

/**
 * Returns the main cultivation of the year and why the field is excluded from BLN3, if it is.
 */
function resolveMainCultivationAndExclusion(
  field: Bln3Field,
  cultivations: Cultivation[],
  b_year: number,
) {
  const targetMainCultivation = findHoofdteelt(cultivations, b_year, true)
  const catalogueCode = targetMainCultivation?.b_lu_catalogue
  const exclusionReason = getBln3ExclusionReason({
    b_bufferstrip: field.b_bufferstrip,
    hasMainCultivation: targetMainCultivation !== null,
    b_lu_croprotation: targetMainCultivation?.b_lu_croprotation,
    b_lu_catalogue: catalogueCode,
  })
  return { targetMainCultivation, catalogueCode, exclusionReason }
}

/**
 * Derives the BLN3 score inputs of a field from its data. Shared by the collectors for a single
 * field and for a farm, so both give the same result.
 */
function deriveBln3ScoreInputs({
  field,
  soilAnalyses,
  cultivations,
  measures,
  timeframe,
}: {
  field: Bln3Field
  soilAnalyses: SoilAnalysis[]
  cultivations: Cultivation[]
  measures: Measure[]
  timeframe?: Timeframe
}): Bln3ScoreCollectedInputs {
  // b_centroid = [lon, lat] (ST_X = longitude, ST_Y = latitude)
  const [a_lon, a_lat] = field.b_centroid

  const soilData = selectLatestSoilValues(soilAnalyses, [
    ...LAB_NUMERIC_FIELDS,
    ...BCS_NUMERIC_FIELDS,
  ])

  // Categorical soil fields: pick from the most recent analysis that has a value.
  const latestWithSoiltype = soilAnalyses.find((a) => a.b_soiltype_agr != null)
  const latestWithGwlClass = soilAnalyses.find((a) => a.b_gwl_class != null)

  const bln3Cultivations = buildBln3CultivationHistory(cultivations, timeframe)
  const b_year = resolveBln3ScoreYear(cultivations, timeframe)
  const { targetMainCultivation, catalogueCode, exclusionReason } =
    resolveMainCultivationAndExclusion(field, cultivations, b_year)

  // Map measures: "bln_BM3" → { measure_id: "BM3", year: 2025 }
  const fallbackYear = timeframe?.end?.getFullYear()
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
    b_year,
    b_soiltype_agr: (latestWithSoiltype?.b_soiltype_agr ??
      undefined) as Bln3ScoreCollectedInputs["b_soiltype_agr"],
    b_gwl_class: (latestWithGwlClass?.b_gwl_class ??
      undefined) as Bln3ScoreCollectedInputs["b_gwl_class"],
    ...(field.b_bufferstrip != null && { b_bufferstrip: field.b_bufferstrip }),
    ...(targetMainCultivation?.b_lu_croprotation && {
      b_lu_croprotation: targetMainCultivation.b_lu_croprotation,
    }),
    ...(catalogueCode && { b_lu_catalogue: catalogueCode }),
    ...(exclusionReason && { isExcluded: true, exclusionReason }),
    ...(bln3Cultivations.length > 0 && {
      cultivations: bln3Cultivations,
    }),
    ...(bln3Measures.length > 0 && { measures: bln3Measures }),
    ...soilData,
  }
}

/**
 * Derives the BLN3 measure applicability inputs of a field from its data. Shared by the
 * collectors for a single field and for a farm, so both give the same result.
 */
function deriveBln3MeasureApplicabilityInputs({
  field,
  soilAnalyses,
  cultivations,
  fertilizerApplications,
  b_year,
  timeframe,
}: {
  field: Bln3Field
  soilAnalyses: SoilAnalysis[]
  cultivations: Cultivation[]
  fertilizerApplications: FertilizerApplication[]
  b_year: number
  timeframe?: Timeframe
}): Bln3MeasureApplicabilityCollectedInputs {
  const [a_lon, a_lat] = field.b_centroid

  const soilData = selectLatestSoilValues(soilAnalyses, LAB_NUMERIC_FIELDS)
  const latestWithSoiltype = soilAnalyses.find((a) => a.b_soiltype_agr != null)
  const latestWithGwlClass = soilAnalyses.find((a) => a.b_gwl_class != null)

  const bln3Cultivations = buildBln3CultivationHistory(cultivations, timeframe)

  const appMethods = Array.from(
    new Set(
      fertilizerApplications
        .map((app) => app.p_app_method)
        .filter((m): m is NonNullable<typeof m> => m != null),
    ),
  ) as string[]

  const { targetMainCultivation, catalogueCode, exclusionReason } =
    resolveMainCultivationAndExclusion(field, cultivations, b_year)

  return {
    a_lat,
    a_lon,
    b_year,
    b_soiltype_agr: latestWithSoiltype?.b_soiltype_agr ?? undefined,
    b_gwl_class: latestWithGwlClass?.b_gwl_class ?? undefined,
    ...(field.b_bufferstrip != null && { b_bufferstrip: field.b_bufferstrip }),
    ...(targetMainCultivation?.b_lu_croprotation && {
      b_lu_croprotation: targetMainCultivation.b_lu_croprotation,
    }),
    ...(catalogueCode && { b_lu_catalogue: catalogueCode }),
    ...(exclusionReason && { isExcluded: true, exclusionReason }),
    ...(appMethods.length > 0 && { p_app_method: appMethods }),
    ...(bln3Cultivations.length > 0 && { cultivations: bln3Cultivations }),
    ...soilData,
  }
}

/**
 * Collects all field data needed for a BLN3 score calculation from the FDM database.
 *
 * Fetches field geometry (lat/lon), the most recent soil analysis, cultivations, and
 * adopted BLN measures for the field, then maps them to the shape expected by the
 * NMI BLN3 API. The caller is responsible for adding `nmiApiKey` before calling
 * `getBln3Score`.
 *
 * For soil analyses, the latest lab data for each relevant parameter is collected. Only if no lab
 * data  is found for a parameter, the latest available NMI BodemSchat estimate is used.
 *
 * To collect the inputs of all fields of a farm, use {@link collectInputForBln3ScoreForFarm},
 * which gives the same result with farm-level queries.
 *
 * @param fdm - The FDM instance for database interaction.
 * @param principal_id - The principal making the request.
 * @param b_id - The field ID for which to collect inputs.
 * @param timeframe - Optional timeframe applied to soil analyses and measures only.
 *   Start date is ignored when retrieving soil analyses.
 *   Cultivations are always fetched without a timeframe to cover the full multi-year
 *   history needed for the BLN3 calculation.
 *   `b_year` is the year of a single-year timeframe. For a multi-year timeframe or none, it
 *   is the latest year with a main cultivation (up to the end of the timeframe).
 * @returns A promise resolving to the collected BLN3 score inputs (without `nmiApiKey`).
 *   `isExcluded` and `exclusionReason` are set for buffer strips, nature fields and fields
 *   without a main cultivation in `b_year`.
 * @throws {Error} If data collection fails.
 */
export async function collectInputForBln3Score(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id: fdmSchema.fieldsTypeSelect["b_id"],
  timeframe?: Timeframe,
): Promise<Bln3ScoreCollectedInputs> {
  try {
    // Fetch all cultivations without timeframe to cover multi-year history
    const [field, soilAnalyses, cultivations, measures] = await Promise.all([
      getField(fdm, principal_id, b_id),
      getSoilAnalyses(fdm, principal_id, b_id, { start: undefined, end: timeframe?.end }),
      getCultivations(fdm, principal_id, b_id),
      getMeasures(fdm, principal_id, b_id, timeframe),
    ])
    return deriveBln3ScoreInputs({ field, soilAnalyses, cultivations, measures, timeframe })
  } catch (error) {
    throw new Error(
      `Failed to collect BLN3 score inputs for field ${b_id}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    )
  }
}

/**
 * Collects the BLN3 score inputs of all fields of a farm from the FDM database.
 *
 * Gives the same inputs per field as {@link collectInputForBln3Score}, but reads the data of
 * the farm with one query per data type and checks the permission once, for the farm.
 * The caller is responsible for adding `nmiApiKey` before calling `getBln3Score` or
 * `getBln3Scores`.
 *
 * @param fdm - The FDM instance for database interaction.
 * @param principal_id - The principal making the request.
 * @param b_id_farm - The farm ID.
 * @param timeframe - Optional timeframe. It selects the fields of the farm and is applied to
 *   soil analyses (end date only) and measures, as in {@link collectInputForBln3Score}.
 *   Cultivations are always fetched without a timeframe.
 * @returns A promise resolving to the fields of the farm in the timeframe (as returned by
 *   `getFields`, so callers need not read them again) and the collected inputs (without
 *   `nmiApiKey`) per field ID.
 * @throws {Error} If data collection fails.
 */
export async function collectInputForBln3ScoreForFarm(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: fdmSchema.farmsTypeSelect["b_id_farm"],
  timeframe?: Timeframe,
): Promise<{ fields: Field[]; inputs: Map<string, Bln3ScoreCollectedInputs> }> {
  try {
    // Fetch all cultivations without timeframe to cover multi-year history
    const [fields, soilAnalysesByField, cultivationsByField, measuresByField] =
      await fdm.transaction((tx: FdmType) =>
        Promise.all([
          getFields(tx, principal_id, b_id_farm, timeframe),
          getSoilAnalysesForFarm(tx, principal_id, b_id_farm, {
            start: undefined,
            end: timeframe?.end,
          }),
          getCultivationsForFarm(tx, principal_id, b_id_farm),
          getMeasuresForFarm(tx, principal_id, b_id_farm, timeframe),
        ]),
      )

    // The farm getters also return fields outside the timeframe, so follow the list of fields
    const inputs = new Map<string, Bln3ScoreCollectedInputs>()
    for (const field of fields) {
      inputs.set(
        field.b_id,
        deriveBln3ScoreInputs({
          field,
          soilAnalyses: soilAnalysesByField.get(field.b_id) ?? [],
          cultivations: cultivationsByField.get(field.b_id) ?? [],
          measures: measuresByField.get(field.b_id) ?? [],
          timeframe,
        }),
      )
    }
    return { fields, inputs }
  } catch (error) {
    throw new Error(
      `Failed to collect BLN3 score inputs for farm ${b_id_farm}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    )
  }
}

/**
 * Collects all field data needed for a BLN3 measure applicability check from the FDM database.
 *
 * Fetches field geometry (lat/lon), soil analysis, and cultivation history to populate GxG and
 * SOM potential fields. Note that `measures` is intentionally excluded per NMI applicability
 * endpoint requirements.
 *
 * For soil analyses, the latest lab data for each relevant parameter is collected. Only if no lab
 * data  is found for a parameter, the latest available NMI BodemSchat estimate is used.
 *
 * To collect the inputs of all fields of a farm, use
 * {@link collectInputForBln3MeasureApplicabilityForFarm}, which gives the same result with
 * farm-level queries.
 *
 * @param fdm - The FDM instance for database interaction.
 * @param principal_id - The principal making the request.
 * @param b_id - The field ID for which to collect inputs.
 * @param b_year - The calendar year for the applicability check.
 * @param timeframe - Optional timeframe applied to soil analyses and fertilizer applications.
 *   Start date is ignored when retrieving soil analyses.
 *   Cultivations are always fetched without a timeframe to cover the full multi-year
 *   history needed for the BLN3 measure applicability estimation.
 * @returns A promise resolving to collected BLN3 measure applicability inputs.
 *   `isExcluded` and `exclusionReason` are set for buffer strips, nature fields and fields
 *   without a main cultivation in `b_year`.
 */
export async function collectInputForBln3MeasureApplicability(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id: fdmSchema.fieldsTypeSelect["b_id"],
  b_year: number,
  timeframe?: Timeframe,
): Promise<Bln3MeasureApplicabilityCollectedInputs> {
  try {
    const [field, soilAnalyses, cultivations, fertilizerApplications] = await Promise.all([
      getField(fdm, principal_id, b_id),
      getSoilAnalyses(fdm, principal_id, b_id, { start: undefined, end: timeframe?.end }),
      getCultivations(fdm, principal_id, b_id),
      getFertilizerApplications(fdm, principal_id, b_id, timeframe).catch(() => []),
    ])
    return deriveBln3MeasureApplicabilityInputs({
      field,
      soilAnalyses,
      cultivations,
      fertilizerApplications,
      b_year,
      timeframe,
    })
  } catch (error) {
    throw new Error(
      `Failed to collect BLN3 measure applicability inputs for field ${b_id}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    )
  }
}

/**
 * Collects the BLN3 measure applicability inputs of all fields of a farm from the FDM database.
 *
 * Gives the same inputs per field as {@link collectInputForBln3MeasureApplicability}, but reads
 * the data of the farm with one query per data type and checks the permission once, for the
 * farm. The same inputs serve the measure advice (`getBln3MeasureAdvice`).
 *
 * @param fdm - The FDM instance for database interaction.
 * @param principal_id - The principal making the request.
 * @param b_id_farm - The farm ID.
 * @param b_year - The calendar year for the applicability check.
 * @param timeframe - Optional timeframe. It selects the fields of the farm and is applied to
 *   soil analyses (end date only) and fertilizer applications, as in
 *   {@link collectInputForBln3MeasureApplicability}. Cultivations are always fetched without a
 *   timeframe.
 * @returns A promise resolving to the collected inputs per field ID.
 * @throws {Error} If data collection fails.
 */
export async function collectInputForBln3MeasureApplicabilityForFarm(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: fdmSchema.farmsTypeSelect["b_id_farm"],
  b_year: number,
  timeframe?: Timeframe,
): Promise<Map<string, Bln3MeasureApplicabilityCollectedInputs>> {
  try {
    const [fields, soilAnalysesByField, cultivationsByField] = await fdm.transaction(
      (tx: FdmType) =>
        Promise.all([
          getFields(tx, principal_id, b_id_farm, timeframe),
          getSoilAnalysesForFarm(tx, principal_id, b_id_farm, {
            start: undefined,
            end: timeframe?.end,
          }),
          getCultivationsForFarm(tx, principal_id, b_id_farm),
        ]),
    )
    // As for a single field, the inputs are still useful without the application methods.
    // Read outside the transaction, so that a failure does not abort it.
    const fertilizerApplicationsByField = await getFertilizerApplicationsForFarm(
      fdm,
      principal_id,
      b_id_farm,
      timeframe,
    ).catch(() => new Map<string, FertilizerApplication[]>())

    // The farm getters also return fields outside the timeframe, so follow the list of fields
    const inputs = new Map<string, Bln3MeasureApplicabilityCollectedInputs>()
    for (const field of fields) {
      inputs.set(
        field.b_id,
        deriveBln3MeasureApplicabilityInputs({
          field,
          soilAnalyses: soilAnalysesByField.get(field.b_id) ?? [],
          cultivations: cultivationsByField.get(field.b_id) ?? [],
          fertilizerApplications: fertilizerApplicationsByField.get(field.b_id) ?? [],
          b_year,
          timeframe,
        }),
      )
    }
    return inputs
  } catch (error) {
    throw new Error(
      `Failed to collect BLN3 measure applicability inputs for farm ${b_id_farm}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    )
  }
}
