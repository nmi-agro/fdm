import { type FdmType, withCalculationCache } from "@nmi-agro/fdm-core"
import Decimal from "decimal.js"
import type {
  PhosphateBalance,
  PhosphateBalanceField,
  PhosphateBalanceFieldResult,
  PhosphateFrame,
  PhosphateBalanceInput,
  PhosphateCultivationDetail,
  PhosphateFertilizerDetail,
  PhosphateFieldInput,
  PhosphateLongTermBalance,
  PhosphateSaturation,
  PhosphateSaturationThreshold,
} from "./types"
import { getMainCultivation } from "../../mineralization/prepare"
import pkg from "../../package"
import { type FieldExclusionReason, getFieldExclusionReason } from "../../shared/field-exclusion"
import { getPhosphateSoilTypeParameters } from "./alpha-max"
import { calculatePhosphateLeaching } from "./leaching"
import {
  calculatePhosphateDeposition,
  calculatePhosphateMineralization,
  yearsInTimeframe,
} from "./mineralization"
import { calculatePhosphateProjection } from "./projection"
import { calculatePhosphateSaturation, calculatePhosphateSaturationThreshold } from "./saturation"
import { assessPhosphateStatus } from "./status"

export type PhosphateBalanceFieldCalculationInput = {
  fieldInput: PhosphateFieldInput
  fertilizerDetails: PhosphateFertilizerDetail[]
  cultivationDetails: PhosphateCultivationDetail[]
  timeFrame: { start: Date; end: Date }
  /** Optional: the same field in earlier years, for the long-term average balance */
  history?: { timeFrame: { start: Date; end: Date }; fieldInput: PhosphateFieldInput }[]
}

/** Calendar year of a timeframe (taken at its middle, so time zones do not shift it). */
function yearOfTimeFrame(timeFrame: { start: Date; end: Date }): number {
  return new Date((timeFrame.start.getTime() + timeFrame.end.getTime()) / 2).getFullYear()
}

/**
 * Whether a field is left out of the phosphate balance, and why: buffer strips, and fields whose
 * main cultivation of the year (see `getMainCultivation`) is a landscape element or a nature
 * cultivation. These fields are not farmed for production, so a balance and a soil P aim say little
 * about them; they are not calculated and not part of the farm average.
 *
 * @param fieldInput - The field input (field and cultivations).
 * @param timeFrame - The timeframe of the balance.
 * @returns The exclusion reason, or `null` when the field is included.
 * @alpha
 */
export function getPhosphateFieldExclusion(
  fieldInput: Pick<PhosphateFieldInput, "field" | "cultivations">,
  timeFrame: { start: Date; end: Date },
): FieldExclusionReason | null {
  const main = getMainCultivation(
    fieldInput.cultivations.map((c) => ({
      ...c,
      b_lu_start: c.b_lu_start ? new Date(c.b_lu_start) : null,
      b_lu_end: c.b_lu_end ? new Date(c.b_lu_end) : null,
    })),
    yearOfTimeFrame(timeFrame),
  )
  return getFieldExclusionReason({
    b_bufferstrip: fieldInput.field.b_bufferstrip,
    b_lu_croprotation: main?.b_lu_croprotation,
    b_lu_catalogue: main?.b_lu_catalogue,
  })
}

/**
 * Removal (kg P2O5 / ha, negative) of the cultivations of an earlier year that have no registered
 * harvest in that year, with the default yield and phosphate content of the catalogue. A crop that is
 * harvested once counts in the year it ends (or starts, without an end date); a crop that is
 * harvested several times (grassland) counts in every year it is on the field.
 */
function estimateDefaultRemoval(
  fieldInput: PhosphateFieldInput,
  details: Map<string, PhosphateCultivationDetail>,
  timeFrame: { start: Date; end: Date },
  missing: string[],
): Decimal {
  const inFrame = (date: Date | null | undefined) =>
    !!date &&
    new Date(date).getTime() >= timeFrame.start.getTime() &&
    new Date(date).getTime() <= timeFrame.end.getTime()
  let total = new Decimal(0)
  for (const cultivation of fieldInput.cultivations) {
    const detail = details.get(cultivation.b_lu_catalogue)
    if (!detail || detail.b_lu_harvestable === "none") continue
    if (fieldInput.harvests.some((h) => h.b_lu === cultivation.b_lu)) continue
    const counts =
      detail.b_lu_harvestable === "multiple" ||
      (cultivation.b_lu_end ? inFrame(cultivation.b_lu_end) : inFrame(cultivation.b_lu_start))
    if (!counts) continue
    if (detail.b_lu_yield == null || detail.b_lu_p_harvestable == null) {
      missing.push(cultivation.b_lu_name ?? detail.b_lu_name ?? cultivation.b_lu_catalogue)
      continue
    }
    total = total.add(
      new Decimal(detail.b_lu_yield).times(detail.b_lu_p_harvestable).dividedBy(1000).times(-1),
    )
  }
  return total
}

/** Number of earlier years in the long-term average. */
const LONG_TERM_HISTORY_YEARS = 4

/**
 * The earlier years of a field for the long-term average: the registered data in `history`, and for
 * years without registered cultivations the crop of `cultivation_history` (e.g. BRP), as a
 * cultivation over the whole year without harvest (so the removal uses the catalogue defaults).
 */
function withCultivationHistory(
  input: PhosphateBalanceFieldCalculationInput,
  currentYear: number,
  details: Map<string, PhosphateCultivationDetail>,
): { timeFrame: { start: Date; end: Date }; fieldInput: PhosphateFieldInput }[] {
  const { fieldInput } = input
  const byYear = new Map(
    (input.history ?? []).map((past) => [yearOfTimeFrame(past.timeFrame), past] as const),
  )
  const result: { timeFrame: { start: Date; end: Date }; fieldInput: PhosphateFieldInput }[] = []
  for (let i = 1; i <= LONG_TERM_HISTORY_YEARS; i++) {
    const year = currentYear - i
    const past = byYear.get(year)
    if (past && past.fieldInput.cultivations.length > 0) {
      result.push(past)
      continue
    }
    const crops = (fieldInput.cultivation_history ?? []).filter((c) => c.year === year)
    if (crops.length === 0) {
      if (past) result.push(past)
      continue
    }
    const shift = (date: Date) => {
      const shifted = new Date(date)
      shifted.setFullYear(shifted.getFullYear() - i)
      return shifted
    }
    const timeFrame = past?.timeFrame ?? {
      start: shift(input.timeFrame.start),
      end: shift(input.timeFrame.end),
    }
    const start = new Date((timeFrame.start.getTime() + timeFrame.end.getTime()) / 2)
    result.push({
      timeFrame,
      fieldInput: {
        ...fieldInput,
        cultivations: crops.map((crop, index) => ({
          b_lu: `history-${year}-${index}`,
          b_lu_catalogue: crop.b_lu_catalogue,
          b_lu_name: details.get(crop.b_lu_catalogue)?.b_lu_name ?? crop.b_lu_catalogue,
          b_lu_croprotation: details.get(crop.b_lu_catalogue)?.b_lu_croprotation ?? "other",
          m_cropresidue: null,
          b_lu_start: start,
          b_lu_end: start,
        })),
        harvests: [],
        fertilizerApplications: past?.fieldInput.fertilizerApplications ?? [],
        cultivation_history: undefined,
      },
    })
  }
  return result
}

/** Short Dutch list of years, e.g. "2022, 2023 en 2025". */
function formatYears(years: number[]): string {
  const sorted = [...years].sort((a, b) => a - b).map(String)
  return sorted.length <= 1
    ? (sorted[0] ?? "")
    : `${sorted.slice(0, -1).join(", ")} en ${sorted[sorted.length - 1]}`
}

/** Phosphate supply by fertilizers: amount (kg / ha) × p_p_rt (g P2O5 / kg) / 1000, at 100% (no working coefficient). */
function calculateSupplyByFertilizers(
  applications: PhosphateFieldInput["fertilizerApplications"],
  details: Map<string, PhosphateFertilizerDetail>,
) {
  type FertilizerType = "mineral" | "manure" | "compost" | "other"
  const totals: Record<FertilizerType, Decimal> = {
    mineral: new Decimal(0),
    manure: new Decimal(0),
    compost: new Decimal(0),
    other: new Decimal(0),
  }
  const items = applications.map(
    (application): { id: string; value: Decimal; type: FertilizerType } => {
      const detail = details.get(application.p_id_catalogue)
      if (!detail) {
        throw new Error(
          `Fertilizer application ${application.p_app_id} has no fertilizerDetails for fertilizer ${application.p_id_catalogue}`,
        )
      }
      const value = new Decimal(application.p_app_amount ?? 0)
        .times(detail.p_p_rt ?? 0)
        .dividedBy(1000)
      const type =
        detail.p_type === "mineral" || detail.p_type === "manure" || detail.p_type === "compost"
          ? detail.p_type
          : "other"
      totals[type] = totals[type].add(value)
      return { id: application.p_app_id, value, type }
    },
  )
  const total = totals.mineral.add(totals.manure).add(totals.compost).add(totals.other)
  return { total, totals, items }
}

/**
 * Phosphate removal by harvests: yield (kg DM / ha) × P content (g P2O5 / kg DM) / 1000.
 * The P content of the harvest's own analysis is used when present, otherwise the catalogue value.
 */
function calculateRemovalByHarvests(
  input: PhosphateFieldInput,
  details: Map<string, PhosphateCultivationDetail>,
  timeFrame: { start: Date; end: Date },
  warnings: string[],
) {
  // A harvestable cultivation that ended in the timeframe (or is harvested several times, like
  // grassland) without any harvest gives no removal: report it instead of silently using 0.
  for (const cultivation of input.cultivations) {
    const detail = details.get(cultivation.b_lu_catalogue)
    if (!detail || detail.b_lu_harvestable === "none") continue
    if (input.harvests.some((h) => h.b_lu === cultivation.b_lu)) continue
    const end = cultivation.b_lu_end ? new Date(cultivation.b_lu_end) : null
    const endedInTimeframe = end !== null && end >= timeFrame.start && end <= timeFrame.end
    if (endedInTimeframe || detail.b_lu_harvestable === "multiple") {
      warnings.push(
        `Voor ${cultivation.b_lu_name ?? cultivation.b_lu_catalogue} is in deze periode geen oogst geregistreerd: de afvoer met de oogst is 0.`,
      )
    }
  }

  const items = input.harvests.map((harvest) => {
    const cultivation = input.cultivations.find((c) => c.b_lu === harvest.b_lu)
    const detail = cultivation ? details.get(cultivation.b_lu_catalogue) : undefined
    if (!detail) {
      throw new Error(`Harvest ${harvest.b_id_harvesting} has no corresponding cultivation details`)
    }
    const analyses = harvest.harvestable.harvestable_analyses
    const name = cultivation?.b_lu_name ?? detail.b_lu_catalogue
    const values = (analyses.length > 0 ? analyses : [{}]).map(
      (analysis: { b_lu_yield?: number | null; b_lu_p_harvestable?: number | null }) => {
        const b_lu_yield = analysis.b_lu_yield ?? detail.b_lu_yield
        const b_lu_p_harvestable = analysis.b_lu_p_harvestable ?? detail.b_lu_p_harvestable
        if (b_lu_p_harvestable == null) {
          warnings.push(
            `Geen fosfaatgehalte bekend voor ${name}: de afvoer met de oogst is op 0 gezet. Controleer of de gewascatalogus is gesynchroniseerd met een NMI API-sleutel.`,
          )
        }
        if (b_lu_yield == null) {
          warnings.push(`Geen opbrengst bekend voor ${name}: de afvoer met de oogst is op 0 gezet.`)
        }
        return new Decimal(b_lu_yield ?? 0)
          .times(b_lu_p_harvestable ?? 0)
          .dividedBy(1000)
          .times(-1)
      },
    )
    const value = values.reduce((a, b) => a.add(b), new Decimal(0)).dividedBy(values.length)
    return { id: harvest.b_id_harvesting, value }
  })
  return { total: items.reduce((a, b) => a.add(b.value), new Decimal(0)), items }
}

/**
 * Phosphate removal by crop residues, only when they are removed (`m_cropresidue === false`):
 * average yield / harvest index × (1 − harvest index) × b_lu_p_residue / 1000.
 */
function calculateRemovalByResidues(
  input: PhosphateFieldInput,
  details: Map<string, PhosphateCultivationDetail>,
) {
  const items = input.cultivations.map((cultivation) => {
    const detail = details.get(cultivation.b_lu_catalogue)
    if (!detail || cultivation.m_cropresidue !== false || !detail.b_lu_hi) {
      return { id: cultivation.b_lu, value: new Decimal(0) }
    }
    const yields = input.harvests
      .filter((h) => h.b_lu === cultivation.b_lu)
      .map(
        (h) =>
          h.harvestable.harvestable_analyses.find((a) => a.b_lu_yield != null)?.b_lu_yield ??
          detail.b_lu_yield ??
          0,
      )
    const b_lu_yield =
      yields.length > 0
        ? yields.reduce((a, b) => a.add(b), new Decimal(0)).dividedBy(yields.length)
        : new Decimal(detail.b_lu_yield ?? 0)
    const value = b_lu_yield
      .dividedBy(detail.b_lu_hi)
      .times(new Decimal(1).minus(detail.b_lu_hi))
      .times(detail.b_lu_p_residue ?? 0)
      .dividedBy(1000)
      .times(-1)
    return { id: cultivation.b_lu, value }
  })
  return { total: items.reduce((a, b) => a.add(b.value), new Decimal(0)), items }
}

/**
 * Determines the Opbouwen / Onderhouden / Afbouwen frame from P-AL, as proposed in the issue:
 * P-AL < 25 opbouwen, 25–45 onderhouden, > 45 afbouwen. The minimum desirable balance is the fixation
 * (offtake + fixation) when building up or maintaining; when reducing, a deficit is acceptable.
 *
 * DRAFT: the same P-AL bands are used for grassland and arable land.
 *
 * @param a_p_al - P-AL (mg P2O5 / 100 g), or `null`.
 * @param fixation - Fixation (kg P2O5 / ha / year).
 * @returns The frame.
 */
export function determinePhosphateFrame(a_p_al: number | null, fixation: number): PhosphateFrame {
  if (a_p_al === null) return { name: null, a_p_al: null, target_balance_min: null }
  if (a_p_al < 25) return { name: "opbouwen", a_p_al, target_balance_min: fixation }
  if (a_p_al <= 45) return { name: "onderhouden", a_p_al, target_balance_min: fixation }
  return { name: "afbouwen", a_p_al, target_balance_min: null }
}

/**
 * The balance terms of a field for one timeframe (kg P2O5 / ha), with the leaching from its surplus.
 */
function calculateFieldTerms(
  fieldInput: PhosphateFieldInput,
  fertilizerDetails: Map<string, PhosphateFertilizerDetail>,
  cultivationDetails: Map<string, PhosphateCultivationDetail>,
  timeFrame: { start: Date; end: Date },
  isGrassland: boolean,
  saturation: PhosphateSaturation,
  threshold: PhosphateSaturationThreshold,
  warnings: string[],
) {
  const fertilizers = calculateSupplyByFertilizers(
    fieldInput.fertilizerApplications,
    fertilizerDetails,
  )
  const harvests = calculateRemovalByHarvests(fieldInput, cultivationDetails, timeFrame, warnings)
  const residues = calculateRemovalByResidues(fieldInput, cultivationDetails)
  const removal = harvests.total.add(residues.total)
  const mineralization = calculatePhosphateMineralization(
    fieldInput,
    cultivationDetails,
    isGrassland,
    timeFrame,
  )
  const deposition = calculatePhosphateDeposition(timeFrame)
  const supply = fertilizers.total.add(mineralization.total).add(deposition.total)
  const balance = supply.add(removal)
  const leaching = calculatePhosphateLeaching(balance, saturation, threshold)
  return {
    fertilizers,
    harvests,
    residues,
    removal,
    mineralization,
    deposition,
    supply,
    balance,
    leaching,
  }
}

/**
 * Calculates the phosphate balance of one field (kg P2O5 / ha for the timeframe), the phosphorus
 * saturation of the topsoil and the effect of the balance on the soil phosphorus stock.
 *
 * Balance = fertilizers + mineralisation + deposition − harvest − removed crop residues. Leaching is
 * estimated from the surplus and reported separately, not subtracted from the balance (as nitrate in
 * the nitrogen balance). The projection uses the long-term average balance (this year and the
 * earlier years in `history` that have data, see `long_term`) plus leaching minus fixation.
 *
 * PROTOTYPE for discussion: parameters to be reviewed.
 *
 * @param input - The field input with the fertilizer and cultivation details and the timeframe.
 * @returns The phosphate balance of the field.
 * @alpha
 */
export function calculatePhosphateBalanceField(
  input: PhosphateBalanceFieldCalculationInput,
): PhosphateBalanceField {
  const { fieldInput, timeFrame } = input
  const { field } = fieldInput
  const isGrassland = fieldInput.cultivations.some((c) => c.b_lu_croprotation === "grass")
  const saturation = calculatePhosphateSaturation(fieldInput.soilAnalyses, isGrassland)
  const frame = determinePhosphateFrame(
    saturation.a_p_al,
    getPhosphateSoilTypeParameters(saturation.b_soiltype_agr).fixation,
  )

  if (field.b_bufferstrip) {
    return {
      b_id: field.b_id,
      b_area: field.b_area ?? 0,
      balance: 0,
      supply: {
        total: 0,
        fertilizers: {
          total: 0,
          mineral: { total: 0, applications: [] },
          manure: { total: 0, applications: [] },
          compost: { total: 0, applications: [] },
          other: { total: 0, applications: [] },
        },
        mineralization: { total: 0, track: "none", warnings: [] },
        deposition: { total: 0 },
      },
      removal: {
        total: 0,
        harvests: { total: 0, harvests: [] },
        residues: { total: 0, cultivations: [] },
      },
      leaching: { total: 0, risk: "unknown", fraction: 0, groundwater_factor: 0, factor: 0 },
      long_term: {
        balance: 0,
        fertilizers: 0,
        leaching: 0,
        years: [],
        fertilizer_years: [],
        estimated_removal_years: [],
        warnings: [],
      },
      frame,
      saturation,
      projection: null,
      warnings: [],
    }
  }

  const fertilizerDetails = new Map(input.fertilizerDetails.map((d) => [d.p_id_catalogue, d]))
  const cultivationDetails = new Map(input.cultivationDetails.map((d) => [d.b_lu_catalogue, d]))
  const threshold = calculatePhosphateSaturationThreshold(saturation, fieldInput.soilAnalyses)

  const warnings: string[] = []
  const terms = calculateFieldTerms(
    fieldInput,
    fertilizerDetails,
    cultivationDetails,
    timeFrame,
    isGrassland,
    saturation,
    threshold,
    warnings,
  )
  const { fertilizers, harvests, residues, removal, mineralization, deposition, supply, balance } =
    terms
  const leaching = terms.leaching

  // Long-term average over this year and the earlier years with a cultivation (crop rotation).
  // See `PhosphateLongTermBalance` for how missing harvests and fertilizer applications are handled.
  const perYear = (value: Decimal, frame: { start: Date; end: Date }) =>
    value.dividedBy(Decimal.max(yearsInTimeframe(frame), 1 / 365))
  const currentYear = yearOfTimeFrame(timeFrame)
  const years = [
    {
      year: currentYear,
      rest: perYear(removal.add(mineralization.total).add(deposition.total), timeFrame),
      fertilizers: perYear(fertilizers.total, timeFrame),
      hasFertilizers: true,
    },
  ]
  const estimatedRemovalYears: number[] = []
  const missingDefaults: string[] = []
  for (const past of withCultivationHistory(input, currentYear, cultivationDetails)) {
    if (past.fieldInput.cultivations.length === 0) continue
    const year = yearOfTimeFrame(past.timeFrame)
    const pastTerms = calculateFieldTerms(
      past.fieldInput,
      fertilizerDetails,
      cultivationDetails,
      past.timeFrame,
      isGrassland,
      saturation,
      threshold,
      [],
    )
    const missingBefore = missingDefaults.length
    const defaultRemoval = estimateDefaultRemoval(
      past.fieldInput,
      cultivationDetails,
      past.timeFrame,
      missingDefaults,
    )
    if (!defaultRemoval.isZero()) estimatedRemovalYears.push(year)
    for (let i = missingBefore; i < missingDefaults.length; i++) {
      missingDefaults[i] = `${missingDefaults[i]} (${year})`
    }
    years.push({
      year,
      rest: perYear(
        pastTerms.removal
          .add(defaultRemoval)
          .add(pastTerms.mineralization.total)
          .add(pastTerms.deposition.total),
        past.timeFrame,
      ),
      fertilizers: perYear(pastTerms.fertilizers.total, past.timeFrame),
      hasFertilizers: past.fieldInput.fertilizerApplications.length > 0,
    })
  }
  const mean = (values: Decimal[]) =>
    values.reduce((a, v) => a.add(v), new Decimal(0)).dividedBy(Math.max(values.length, 1))
  const fertilizedYears = years.filter((y) => y.hasFertilizers)
  const longTermFertilizers = mean(fertilizedYears.map((y) => y.fertilizers))
  const longTermBalance = longTermFertilizers.add(mean(years.map((y) => y.rest)))
  const longTermWarnings: string[] = []
  const unfertilized = years.filter((y) => !y.hasFertilizers).map((y) => y.year)
  if (unfertilized.length > 0) {
    longTermWarnings.push(
      `Voor ${formatYears(unfertilized)} is geen bemesting geregistreerd: daarvoor is de gemiddelde bemesting van de andere jaren gebruikt. Voeg de bemesting van eerdere jaren toe voor een beter saldo op lange termijn.`,
    )
  }
  if (missingDefaults.length > 0) {
    longTermWarnings.push(
      `Geen standaardopbrengst of fosfaatgehalte bekend voor ${[...new Set(missingDefaults)].join(", ")}: voeg de oogst toe voor een beter saldo op lange termijn.`,
    )
  }
  const long_term: PhosphateLongTermBalance = {
    balance: longTermBalance.toNumber(),
    fertilizers: longTermFertilizers.toNumber(),
    leaching: calculatePhosphateLeaching(longTermBalance, saturation, threshold).total,
    years: years.map((y) => y.year).sort((a, b) => a - b),
    fertilizer_years: fertilizedYears.map((y) => y.year).sort((a, b) => a - b),
    estimated_removal_years: estimatedRemovalYears.sort((a, b) => a - b),
    warnings: longTermWarnings,
  }

  const projection = calculatePhosphateProjection(
    long_term.balance + long_term.leaching,
    saturation,
    threshold,
    fieldInput.soilAnalyses,
    isGrassland,
  )

  const toItems = (items: { id: string; value: Decimal }[]) =>
    items.map((item) => ({ id: item.id, value: item.value.toNumber() }))
  const fertilizerType = (type: keyof typeof fertilizers.totals) => ({
    total: fertilizers.totals[type].toNumber(),
    applications: toItems(fertilizers.items.filter((item) => item.type === type)),
  })
  return {
    b_id: field.b_id,
    b_area: field.b_area ?? 0,
    balance: balance.toNumber(),
    supply: {
      total: supply.toNumber(),
      fertilizers: {
        total: fertilizers.total.toNumber(),
        mineral: fertilizerType("mineral"),
        manure: fertilizerType("manure"),
        compost: fertilizerType("compost"),
        other: fertilizerType("other"),
      },
      mineralization,
      deposition,
    },
    removal: {
      total: removal.toNumber(),
      harvests: { total: harvests.total.toNumber(), harvests: toItems(harvests.items) },
      residues: { total: residues.total.toNumber(), cultivations: toItems(residues.items) },
    },
    leaching,
    long_term,
    frame,
    saturation,
    projection,
    warnings: [...new Set(warnings)],
  }
}

/**
 * Cached version of `calculatePhosphateBalanceField` (same input and output). The cache key includes
 * `pkg.calculatorVersion`, so results are recalculated after a calculator release.
 *
 * @alpha
 */
export const getPhosphateBalanceField = withCalculationCache(
  calculatePhosphateBalanceField,
  "calculatePhosphateBalanceField",
  pkg.calculatorVersion,
)

/**
 * Aggregates field results to the farm: the area-weighted average per ha of supply, removal,
 * balance and leaching, and the area per verdict of `assessPhosphateStatus`. Buffer strips, nature
 * and landscape elements (`exclusion`) and fields whose balance could not be calculated are excluded.
 *
 * @param fields - The results per field.
 * @param fieldErrorMessages - The error messages of the fields that failed.
 * @returns The farm balance.
 * @alpha
 */
export function calculatePhosphateBalanceFieldsToFarm(
  fields: PhosphateBalanceFieldResult[],
  fieldErrorMessages: string[],
): PhosphateBalance {
  const counted = fields.filter(
    (f): f is PhosphateBalanceFieldResult & { balance: PhosphateBalanceField } =>
      f.balance !== undefined && !f.b_bufferstrip && f.b_area > 0,
  )
  const area = counted.reduce((a, f) => a.add(f.b_area), new Decimal(0))
  const weighted = (pick: (f: PhosphateBalanceField) => number) =>
    area.isZero()
      ? 0
      : counted
          .reduce((a, f) => a.add(new Decimal(pick(f.balance)).times(f.b_area)), new Decimal(0))
          .dividedBy(area)
          .toNumber()
  const status_area: PhosphateBalance["status_area"] = {
    adjust: { area: 0, count: 0 },
    attention: { area: 0, count: 0 },
    good: { area: 0, count: 0 },
    unknown: { area: 0, count: 0 },
  }
  for (const f of counted) {
    const { verdict } = assessPhosphateStatus(f.balance)
    status_area[verdict].area += f.b_area
    status_area[verdict].count += 1
  }
  return {
    balance: weighted((f) => f.balance),
    supply: weighted((f) => f.supply.total),
    removal: weighted((f) => f.removal.total),
    leaching: weighted((f) => f.leaching.total),
    long_term_balance: weighted((f) => f.long_term.balance),
    status_area,
    terms: {
      supply: {
        mineral: weighted((f) => f.supply.fertilizers.mineral.total),
        manure: weighted((f) => f.supply.fertilizers.manure.total),
        compost: weighted((f) => f.supply.fertilizers.compost.total),
        other: weighted((f) => f.supply.fertilizers.other.total),
        mineralization: weighted((f) => f.supply.mineralization.total),
        deposition: weighted((f) => f.supply.deposition.total),
      },
      removal: {
        harvests: weighted((f) => f.removal.harvests.total),
        residues: weighted((f) => f.removal.residues.total),
      },
    },
    fields,
    hasErrors: fields.some((f) => f.errorMessage !== undefined),
    fieldErrorMessages,
  }
}

/**
 * Calculates the phosphate balance of a farm as the area-weighted average per ha of its fields.
 * Buffer strips, nature and landscape elements are not calculated (`exclusion`, see
 * `getPhosphateFieldExclusion`) and not part of the farm average. Fields are calculated in batches of 50 with the
 * cached `getPhosphateBalanceField`; a failing field is reported in `fields[].errorMessage` instead
 * of failing the farm.
 *
 * @param fdm - The FDM instance (used for the calculation cache).
 * @param input - The farm input.
 * @returns The farm balance and the results per field.
 * @alpha
 */
export async function calculatePhosphateBalance(
  fdm: FdmType,
  input: PhosphateBalanceInput,
): Promise<PhosphateBalance> {
  if (input.fields.length === 0) {
    const errorMessage = "No fields in input"
    return { ...calculatePhosphateBalanceFieldsToFarm([], [errorMessage]), errorMessage }
  }

  const results: PhosphateBalanceFieldResult[] = []
  const batchSize = 50
  for (let i = 0; i < input.fields.length; i += batchSize) {
    const batch = input.fields.slice(i, i + batchSize)
    const batchResults = await Promise.all(
      batch.map(async (fieldInput): Promise<PhosphateBalanceFieldResult> => {
        const base = {
          b_id: fieldInput.field.b_id,
          b_area: fieldInput.field.b_area ?? 0,
          b_bufferstrip: fieldInput.field.b_bufferstrip ?? false,
        }
        const exclusion = getPhosphateFieldExclusion(fieldInput, input.timeFrame)
        if (exclusion) return { ...base, exclusion }
        try {
          const history = (input.history ?? []).flatMap((year) => {
            const past = year.fields.find((f) => f.field.b_id === fieldInput.field.b_id)
            return past ? [{ timeFrame: year.timeFrame, fieldInput: past }] : []
          })
          const balance = await getPhosphateBalanceField(fdm, {
            fieldInput,
            fertilizerDetails: input.fertilizerDetails,
            cultivationDetails: input.cultivationDetails,
            timeFrame: input.timeFrame,
            ...(history.length > 0 ? { history } : {}),
          })
          return { ...base, balance }
        } catch (error) {
          return { ...base, errorMessage: error instanceof Error ? error.message : String(error) }
        }
      }),
    )
    results.push(...batchResults)
  }

  const fieldErrorMessages = results
    .filter((r) => r.errorMessage !== undefined)
    .map((r) => r.errorMessage as string)
  return calculatePhosphateBalanceFieldsToFarm(results, fieldErrorMessages)
}
