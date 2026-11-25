import type { FdmType, fdmSchema, PrincipalId, Timeframe } from "@nmi-agro/fdm-core"
import {
  getCultivations,
  getCultivationsForFarm,
  getCultivationsFromCatalogue,
  getCultivationsFromCatalogues,
  getEnabledCultivationCataloguesForFarms,
  getEnabledFertilizerCataloguesForFarms,
  getFertilizerApplications,
  getFertilizerApplicationsForFarm,
  getFertilizersFromCatalogue,
  getFertilizersFromCatalogues,
  getField,
  getFields,
  getHarvests,
  getHarvestsForFarm,
  getSoilAnalyses,
  getSoilAnalysesForFarm,
} from "@nmi-agro/fdm-core"
import { subYears } from "date-fns"
import type {
  PhosphateBalanceHistoryYear,
  PhosphateBalanceInput,
  PhosphateFieldInput,
} from "./types"
import { getSoilParameterEstimates } from "../../estimates"
import { PHOSPHATE_HISTORY_YEARS } from "./long-term"

/** Maximum number of simultaneous requests to the NMI API for the soil estimates. */
const NMI_ESTIMATES_CONCURRENCY = 10

/** Options for the input collection. */
export type PhosphateInputOptions = {
  /** Number of earlier years to collect for the long-term average (0: none). Default 4. */
  historyYears?: number
  /**
   * NMI API key. When given, the NMI soil estimates of each field are added (see
   * `addSoilEstimates`): the crop history and, without measured oxalate data, the estimated
   * phosphorus saturation. Without a key the input has only the registered data.
   */
  nmiApiKey?: string
}

/**
 * Adds the NMI soil estimates (BodemSchat) to the fields of the inputs, with one cache lookup and
 * at most `NMI_ESTIMATES_CONCURRENCY` NMI requests at the same time:
 * - the crop history of the earlier years (BRP), so the long-term average also covers years without
 *   registered cultivations;
 * - for a field without a soil analysis that has P-ox, Fe-ox and Al-ox, the estimated oxalate
 *   values, P-CaCl₂ and PSD, as an undated analysis, so measured analyses still come first.
 *
 * Buffer strips and fields without a centroid are left as they are, and so is a field whose
 * estimates cannot be retrieved.
 */
async function addSoilEstimates(
  fdm: FdmType,
  inputs: { fields: PhosphateFieldInput[]; timeFrame: { start: Date; end: Date } }[],
  nmiApiKey: string,
  historyYears: number,
): Promise<void> {
  const targets = inputs.flatMap((input) => {
    const year = new Date(
      (input.timeFrame.start.getTime() + input.timeFrame.end.getTime()) / 2,
    ).getFullYear()
    return input.fields.flatMap((fieldInput, index) => {
      const centroid = fieldInput.field.b_centroid
      if (fieldInput.field.b_bufferstrip || !centroid) return []
      return [{ input, index, year, centroid }]
    })
  })
  const estimates = await Promise.allSettled(
    getSoilParameterEstimates.many(
      fdm,
      targets.map(({ centroid: [a_lon, a_lat] }) => ({ a_lat, a_lon, nmiApiKey })),
      { concurrency: NMI_ESTIMATES_CONCURRENCY },
    ),
  )
  targets.forEach(({ input, index, year }, i) => {
    const result = estimates[i]
    if (result.status !== "fulfilled") return
    const estimate = result.value
    const fieldInput = input.fields[index]
    const cultivation_history = estimate.cultivations
      .filter((c) => c.year < year && c.year >= year - historyYears)
      .map((c) => ({ year: c.year, b_lu_catalogue: `nl_${c.b_lu_brp}` }))
    const hasOxalate = fieldInput.soilAnalyses.some(
      (a) => a.a_p_ox != null && a.a_fe_ox != null && a.a_al_ox != null,
    )
    input.fields[index] = {
      ...fieldInput,
      soilAnalyses: hasOxalate
        ? fieldInput.soilAnalyses
        : [
            ...fieldInput.soilAnalyses,
            {
              a_source: estimate.a_source,
              a_p_ox: estimate.a_p_ox,
              a_fe_ox: estimate.a_fe_ox,
              a_al_ox: estimate.a_al_ox,
              a_p_cc: estimate.a_p_cc,
              a_p_sg: estimate.a_p_sg,
            },
          ],
      ...(cultivation_history.length > 0 ? { cultivation_history } : {}),
    }
  })
}

/**
 * Default timeframe when the timeframe has no start or end: the current calendar year, ending at the
 * last millisecond of 31 December so events later that day are included. When only one bound is
 * given and the default would come after it (a start after this year, or an end before it), the
 * calendar year of that bound is used instead, so the timeframe is always ordered. The bounds stay
 * finite because supply terms such as deposition scale with the length of the timeframe.
 */
function toTimeFrame(timeframe: Timeframe): { start: Date; end: Date } {
  const startOfYear = (year: number) => new Date(year, 0, 1)
  const endOfYear = (year: number) => new Date(year, 11, 31, 23, 59, 59, 999)
  const year = new Date().getFullYear()
  const start =
    timeframe.start ??
    (timeframe.end && timeframe.end < startOfYear(year)
      ? startOfYear(timeframe.end.getFullYear())
      : startOfYear(year))
  const end =
    timeframe.end ??
    (timeframe.start && timeframe.start > endOfYear(year)
      ? endOfYear(timeframe.start.getFullYear())
      : endOfYear(year))
  return { start, end }
}

/**
 * Collects the field inputs of a farm, or of one of its fields.
 *
 * One field: the per-field fdm-core functions. All fields: the farm-level functions, so the number
 * of queries does not grow with the number of fields. Soil analyses are collected without the
 * timeframe: the most recent ones describe the soil, and older ones show its history.
 */
async function collectFieldInputs(
  tx: FdmType,
  principal_id: PrincipalId,
  b_id_farm: fdmSchema.farmsTypeSelect["b_id_farm"],
  timeframe: Timeframe,
  b_id?: fdmSchema.fieldsTypeSelect["b_id"],
): Promise<PhosphateFieldInput[]> {
  if (b_id) {
    const field = await getField(tx, principal_id, b_id)
    if (field.b_id_farm !== b_id_farm) {
      throw new Error(`Field ${b_id} does not belong to farm ${b_id_farm}`)
    }
    const cultivations = await getCultivations(tx, principal_id, field.b_id, timeframe)
    const harvests = (
      await Promise.all(cultivations.map((c) => getHarvests(tx, principal_id, c.b_lu, timeframe)))
    ).flat()
    const soilAnalyses = await getSoilAnalyses(tx, principal_id, field.b_id)
    const fertilizerApplications = await getFertilizerApplications(
      tx,
      principal_id,
      field.b_id,
      timeframe,
    )
    return [{ field, cultivations, harvests, soilAnalyses, fertilizerApplications }]
  }

  const fields = await getFields(tx, principal_id, b_id_farm, timeframe)
  const [cultivationsByField, harvestsByCultivation, soilByField, applicationsByField] =
    await Promise.all([
      getCultivationsForFarm(tx, principal_id, b_id_farm, timeframe),
      getHarvestsForFarm(tx, principal_id, b_id_farm, timeframe),
      getSoilAnalysesForFarm(tx, principal_id, b_id_farm),
      getFertilizerApplicationsForFarm(tx, principal_id, b_id_farm, timeframe),
    ])
  return fields.map((field) => {
    const cultivations = cultivationsByField.get(field.b_id) ?? []
    return {
      field,
      cultivations,
      harvests: cultivations.flatMap((c) => harvestsByCultivation.get(c.b_lu) ?? []),
      soilAnalyses: soilByField.get(field.b_id) ?? [],
      fertilizerApplications: applicationsByField.get(field.b_id) ?? [],
    }
  })
}

/** Whether a date lies in the timeframe (inclusive). */
function inFrame(date: Date | null | undefined, frame: { start: Date; end: Date }): boolean {
  if (!date) return false
  const t = new Date(date).getTime()
  return t >= frame.start.getTime() && t <= frame.end.getTime()
}

/**
 * Collects the earlier years in one query set (the whole period before the timeframe) and splits
 * them per year: fertilizer applications and harvests by their date, cultivations that overlap the
 * year. Soil analyses are the same for every year.
 */
async function collectHistory(
  tx: FdmType,
  principal_id: PrincipalId,
  b_id_farm: fdmSchema.farmsTypeSelect["b_id_farm"],
  timeFrame: { start: Date; end: Date },
  historyYears: number,
  b_id?: fdmSchema.fieldsTypeSelect["b_id"],
): Promise<PhosphateBalanceHistoryYear[]> {
  if (historyYears <= 0) return []
  const period = {
    start: subYears(timeFrame.start, historyYears),
    end: new Date(timeFrame.start.getTime() - 1),
  }
  const fields = await collectFieldInputs(tx, principal_id, b_id_farm, period, b_id)
  return Array.from({ length: historyYears }, (_, i) => {
    const frame = { start: subYears(timeFrame.start, i + 1), end: subYears(timeFrame.end, i + 1) }
    return {
      timeFrame: frame,
      fields: fields.map((f) => ({
        ...f,
        cultivations: f.cultivations.filter(
          (c) =>
            (!c.b_lu_start || new Date(c.b_lu_start).getTime() <= frame.end.getTime()) &&
            (!c.b_lu_end || new Date(c.b_lu_end).getTime() >= frame.start.getTime()),
        ),
        harvests: f.harvests.filter((h) => inFrame(h.b_lu_harvest_date, frame)),
        fertilizerApplications: f.fertilizerApplications.filter((a) =>
          inFrame(a.p_app_date, frame),
        ),
      })),
    }
  })
}

/**
 * Collects the input for the phosphate balance of a farm, or of one of its fields.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - The principal requesting the data.
 * @param b_id_farm - The farm.
 * @param timeframe - The period of the balance.
 * @param b_id - Optional field; when given, only this field is collected.
 * @param options - `historyYears`: earlier years for the long-term average (default 4);
 *   `nmiApiKey`: adds the NMI soil estimates and crop history.
 * @returns The input for `calculatePhosphateBalance`.
 * @alpha
 */
export async function collectInputForPhosphateBalance(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: fdmSchema.farmsTypeSelect["b_id_farm"],
  timeframe: Timeframe,
  b_id?: fdmSchema.fieldsTypeSelect["b_id"],
  options: PhosphateInputOptions = {},
): Promise<PhosphateBalanceInput> {
  const timeFrame = toTimeFrame(timeframe)
  const historyYears = options.historyYears ?? PHOSPHATE_HISTORY_YEARS
  const input = await fdm.transaction(async (tx: FdmType) => {
    const [fields, history, cultivationDetails, fertilizerDetails] = await Promise.all([
      collectFieldInputs(tx, principal_id, b_id_farm, timeFrame, b_id),
      collectHistory(tx, principal_id, b_id_farm, timeFrame, historyYears, b_id),
      getCultivationsFromCatalogue(tx, principal_id, b_id_farm),
      getFertilizersFromCatalogue(tx, principal_id, b_id_farm),
    ])
    return { fields, cultivationDetails, fertilizerDetails, timeFrame, history }
  })
  // Outside the transaction: the NMI requests should not hold a database connection
  if (options.nmiApiKey) {
    await addSoilEstimates(fdm, [input], options.nmiApiKey, historyYears)
  }
  return input
}

/**
 * Collects the input for the phosphate balance of several farms (e.g. of an organisation), with the
 * catalogues fetched once for all farms. A farm whose input cannot be collected is left out and
 * logged, as in the organic matter balance.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - The principal requesting the data.
 * @param farmIds - The farms.
 * @param timeframe - The period of the balance.
 * @param options - `historyYears`: earlier years for the long-term average (default 4);
 *   `nmiApiKey`: adds the NMI soil estimates and crop history.
 * @returns The input per farm, with its `b_id_farm`.
 * @alpha
 */
export async function collectInputForPhosphateBalanceForFarms(
  fdm: FdmType,
  principal_id: PrincipalId,
  farmIds: fdmSchema.farmsTypeSelect["b_id_farm"][],
  timeframe: Timeframe,
  options: PhosphateInputOptions = {},
): Promise<(PhosphateBalanceInput & { b_id_farm: string })[]> {
  const timeFrame = toTimeFrame(timeframe)
  const historyYears = options.historyYears ?? PHOSPHATE_HISTORY_YEARS
  const uniqueFarmIds = [...new Set(farmIds)]
  const { farms, allCultivations, allFertilizers, cultivationCatalogues, fertilizerCatalogues } =
    await fdm.transaction(async (tx: FdmType) => {
      const [cultivationCatalogues, fertilizerCatalogues] = await Promise.all([
        getEnabledCultivationCataloguesForFarms(tx, principal_id, uniqueFarmIds),
        getEnabledFertilizerCataloguesForFarms(tx, principal_id, uniqueFarmIds),
      ])
      const [allCultivations, allFertilizers] = await Promise.all([
        getCultivationsFromCatalogues(tx, [
          ...new Set(Object.values(cultivationCatalogues).flat()),
        ]),
        getFertilizersFromCatalogues(tx, principal_id, [
          ...new Set(Object.values(fertilizerCatalogues).flat()),
        ]),
      ])

      const settled = await Promise.allSettled(
        uniqueFarmIds.map(async (b_id_farm) => {
          const [fields, history] = await Promise.all([
            collectFieldInputs(tx, principal_id, b_id_farm, timeFrame),
            collectHistory(tx, principal_id, b_id_farm, timeFrame, historyYears),
          ])
          return { b_id_farm, fields, timeFrame, history }
        }),
      )
      const farms = settled.flatMap((result, i) => {
        if (result.status === "fulfilled") return [result.value]
        console.error(
          `Failed to collect phosphate balance input for farm ${uniqueFarmIds[i]}:`,
          result.reason,
        )
        return []
      })
      return { farms, allCultivations, allFertilizers, cultivationCatalogues, fertilizerCatalogues }
    })

  // Outside the transaction: the NMI requests should not hold a database connection
  if (options.nmiApiKey) {
    await addSoilEstimates(fdm, farms, options.nmiApiKey, historyYears)
  }

  // The catalogue details of the crops and fertilizers each farm uses, also in earlier years and in
  // its crop history
  return farms.map((farm) => {
    const allFields = [...farm.fields, ...farm.history.flatMap((year) => year.fields)]
    const cultivationSources = new Set(cultivationCatalogues[farm.b_id_farm] ?? [])
    const cultivationIds = new Set([
      ...allFields.flatMap((f) => f.cultivations.map((c) => c.b_lu_catalogue)),
      ...farm.fields.flatMap((f) => (f.cultivation_history ?? []).map((c) => c.b_lu_catalogue)),
    ])
    const fertilizerSources = new Set(fertilizerCatalogues[farm.b_id_farm] ?? [])
    const fertilizerIds = new Set(
      allFields.flatMap((f) => f.fertilizerApplications.map((a) => a.p_id_catalogue)),
    )
    return {
      ...farm,
      cultivationDetails: allCultivations.filter(
        (c) => cultivationSources.has(c.b_lu_source) && cultivationIds.has(c.b_lu_catalogue),
      ),
      fertilizerDetails: allFertilizers.filter(
        (f) => fertilizerSources.has(f.p_source) && fertilizerIds.has(f.p_id_catalogue),
      ),
    }
  })
}
