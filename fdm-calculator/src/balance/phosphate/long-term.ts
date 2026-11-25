import Decimal from "decimal.js"
import type {
  PhosphateBalanceFieldInput,
  PhosphateCultivationDetail,
  PhosphateFertilizerDetail,
  PhosphateFieldInput,
  PhosphateLongTermBalance,
  PhosphateSaturation,
  PhosphateSaturationThreshold,
} from "./types"
import { calculatePhosphateLeaching } from "./leaching"
import { yearsInTimeframe } from "./supply/deposition"
import { calculatePhosphateFieldTerms, getMainCultivationOfField, yearOfTimeFrame } from "./terms"

/** Number of earlier years in the long-term average balance (so up to 5 years with this year). */
export const PHOSPHATE_HISTORY_YEARS = 4

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
    if (!detail) {
      // Unknown crop (e.g. from a catalogue that is not enabled for the farm): report it instead of
      // silently using no removal
      if (!fieldInput.harvests.some((h) => h.b_lu === cultivation.b_lu)) {
        missing.push(cultivation.b_lu_name ?? cultivation.b_lu_catalogue)
      }
      continue
    }
    if (detail.b_lu_harvestable === "none") continue
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

/**
 * The earlier years of a field for the long-term average: the registered data in `history`, and for
 * years without registered cultivations the crop of `cultivation_history` (e.g. BRP), as a
 * cultivation over the whole year without harvest (so the removal uses the catalogue defaults). When
 * the crop history has no crop for a year either, the main cultivation of the current year is used.
 *
 * Also returns the earlier years that make the long-term average only indicative: years without a
 * registered or historical crop, or without registered fertilizer applications.
 */
function withCultivationHistory(
  input: PhosphateBalanceFieldInput,
  currentYear: number,
  details: Map<string, PhosphateCultivationDetail>,
): {
  years: { timeFrame: { start: Date; end: Date }; fieldInput: PhosphateFieldInput }[]
  incompleteYears: number[]
} {
  const { fieldInput } = input
  const byYear = new Map(
    (input.history ?? []).map((past) => [yearOfTimeFrame(past.timeFrame), past] as const),
  )
  const currentCrop = getMainCultivationOfField(fieldInput, currentYear)
  const result: { timeFrame: { start: Date; end: Date }; fieldInput: PhosphateFieldInput }[] = []
  const incompleteYears: number[] = []
  for (let i = 1; i <= PHOSPHATE_HISTORY_YEARS; i++) {
    const year = currentYear - i
    const past = byYear.get(year)
    const historyCrops = (fieldInput.cultivation_history ?? []).filter((c) => c.year === year)
    const hasCrop = (past?.fieldInput.cultivations.length ?? 0) > 0 || historyCrops.length > 0
    const hasFertilizers = (past?.fieldInput.fertilizerApplications.length ?? 0) > 0
    if (!hasCrop || !hasFertilizers) incompleteYears.push(year)

    if (past && past.fieldInput.cultivations.length > 0) {
      result.push(past)
      continue
    }
    const crops =
      historyCrops.length > 0
        ? historyCrops
        : currentCrop
          ? [{ year, b_lu_catalogue: currentCrop.b_lu_catalogue }]
          : []
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
  return { years: result, incompleteYears }
}

/** Short Dutch list of years, e.g. "2022, 2023 en 2025". */
function formatYears(years: number[]): string {
  const sorted = [...years].sort((a, b) => a - b).map(String)
  return sorted.length <= 1
    ? (sorted[0] ?? "")
    : `${sorted.slice(0, -1).join(", ")} en ${sorted[sorted.length - 1]}`
}

/**
 * Calculates the long-term average balance of a field (kg P2O5 / ha / year) over the selected year
 * and the earlier years with a cultivation and registered data, so the crop rotation is taken into
 * account. See `PhosphateLongTermBalance` for how missing harvests and fertilizer applications are
 * handled.
 *
 * @param input - The field input with its earlier years (`history`).
 * @param current - The terms of the selected year (from `calculatePhosphateFieldTerms`).
 * @param fertilizerDetails - The fertilizer details by `p_id_catalogue`.
 * @param cultivationDetails - The cultivation details by `b_lu_catalogue`.
 * @param saturation - The phosphorus saturation of the field.
 * @param threshold - The PSD threshold of the field.
 * @returns The long-term average balance, its leaching and what the user can add.
 */
export function calculatePhosphateLongTermBalance(
  input: PhosphateBalanceFieldInput,
  current: ReturnType<typeof calculatePhosphateFieldTerms>,
  fertilizerDetails: Map<string, PhosphateFertilizerDetail>,
  cultivationDetails: Map<string, PhosphateCultivationDetail>,
  saturation: PhosphateSaturation,
  threshold: PhosphateSaturationThreshold,
): PhosphateLongTermBalance {
  const { timeFrame } = input
  const perYear = (value: Decimal, frame: { start: Date; end: Date }) =>
    value.dividedBy(Decimal.max(yearsInTimeframe(frame), 1 / 365))
  const currentYear = yearOfTimeFrame(timeFrame)
  const years = [
    {
      year: currentYear,
      rest: perYear(
        current.removal.total
          .add(current.supply.mineralization.total)
          .add(current.supply.deposition.total),
        timeFrame,
      ),
      fertilizers: perYear(current.supply.fertilizers.total, timeFrame),
      hasFertilizers: true,
    },
  ]
  const estimatedRemovalYears: number[] = []
  const missingDefaults: string[] = []
  const yearsWithoutData: number[] = []
  const { years: pastYears, incompleteYears } = withCultivationHistory(
    input,
    currentYear,
    cultivationDetails,
  )
  for (const past of pastYears) {
    if (past.fieldInput.cultivations.length === 0) continue
    const year = yearOfTimeFrame(past.timeFrame)
    // Only years with registered data count: a crop (e.g. from the BRP history) alone would give an
    // average of estimated removal and borrowed fertilisation
    if (
      past.fieldInput.fertilizerApplications.length === 0 &&
      past.fieldInput.harvests.length === 0
    ) {
      yearsWithoutData.push(year)
      continue
    }
    // Harvests of a crop without catalogue details (e.g. from a catalogue that is no longer enabled)
    // are left out, so they don't fail the field; `estimateDefaultRemoval` then reports the crop
    const hasDetails = (b_lu: string) => {
      const cultivation = past.fieldInput.cultivations.find((c) => c.b_lu === b_lu)
      return cultivation !== undefined && cultivationDetails.has(cultivation.b_lu_catalogue)
    }
    const pastInput = {
      ...past.fieldInput,
      harvests: past.fieldInput.harvests.filter((h) => hasDetails(h.b_lu)),
    }
    // The land use of that year, not of the selected year
    const pastTerms = calculatePhosphateFieldTerms(
      pastInput,
      fertilizerDetails,
      cultivationDetails,
      past.timeFrame,
      saturation,
      threshold,
      [],
    )
    const missingBefore = missingDefaults.length
    const defaultRemoval = estimateDefaultRemoval(
      pastInput,
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
        pastTerms.removal.total
          .add(defaultRemoval)
          .add(pastTerms.supply.mineralization.total)
          .add(pastTerms.supply.deposition.total),
        past.timeFrame,
      ),
      fertilizers: perYear(pastTerms.supply.fertilizers.total, past.timeFrame),
      hasFertilizers: past.fieldInput.fertilizerApplications.length > 0,
    })
  }
  const mean = (values: Decimal[]) =>
    values.reduce((a, v) => a.add(v), new Decimal(0)).dividedBy(Math.max(values.length, 1))
  const fertilizedYears = years.filter((y) => y.hasFertilizers)
  const longTermFertilizers = mean(fertilizedYears.map((y) => y.fertilizers))
  const longTermBalance = longTermFertilizers.add(mean(years.map((y) => y.rest)))
  const warnings: string[] = []
  if (incompleteYears.length > 0) {
    warnings.push(
      `De balans op lange termijn is alleen indicatief: voor ${formatYears(incompleteYears)} zijn geen gewassen of geen bemesting bekend.`,
    )
  }
  if (yearsWithoutData.length > 0) {
    warnings.push(
      years.length === 1
        ? `Voor ${formatYears(yearsWithoutData)} zijn geen bemesting en oogst geregistreerd: de trend gebruikt alleen de balans van ${currentYear}. Voeg de bemesting en oogsten van eerdere jaren toe voor een gemiddelde balans over de vruchtwisseling.`
        : `Voor ${formatYears(yearsWithoutData)} zijn geen bemesting en oogst geregistreerd: deze jaren tellen niet mee in de gemiddelde balans. Voeg de bemesting en oogsten van die jaren toe voor een betere balans op lange termijn.`,
    )
  }
  const unfertilized = years.filter((y) => !y.hasFertilizers).map((y) => y.year)
  if (unfertilized.length > 0) {
    warnings.push(
      `Voor ${formatYears(unfertilized)} is geen bemesting geregistreerd: daarvoor is de gemiddelde bemesting van de andere jaren gebruikt. Voeg de bemesting van eerdere jaren toe voor een betere balans op lange termijn.`,
    )
  }
  if (missingDefaults.length > 0) {
    warnings.push(
      `Geen standaardopbrengst of fosfaatgehalte bekend voor ${[...new Set(missingDefaults)].join(", ")}: voeg de oogst toe voor een betere balans op lange termijn.`,
    )
  }
  return {
    balance: longTermBalance.toNumber(),
    fertilizers: longTermFertilizers.toNumber(),
    leaching: calculatePhosphateLeaching(longTermBalance, saturation, threshold).total,
    years: years.map((y) => y.year).sort((a, b) => a - b),
    fertilizer_years: fertilizedYears.map((y) => y.year).sort((a, b) => a - b),
    estimated_removal_years: estimatedRemovalYears.sort((a, b) => a - b),
    warnings,
  }
}
