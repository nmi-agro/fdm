import type {
  PhosphateCultivationDetail,
  PhosphateFertilizerDetail,
  PhosphateFieldInput,
  PhosphateSaturation,
  PhosphateSaturationThreshold,
} from "./types"
import { getMainCultivation } from "../../mineralization/prepare"
import { calculatePhosphateLeaching } from "./leaching"
import { calculatePhosphateRemoval } from "./removal"
import { calculatePhosphateSupply } from "./supply"

/** Calendar year of a timeframe (taken at its middle, so time zones do not shift it). */
export function yearOfTimeFrame(timeFrame: { start: Date; end: Date }): number {
  return new Date((timeFrame.start.getTime() + timeFrame.end.getTime()) / 2).getFullYear()
}

/** Main cultivation of a field in a year (see `getMainCultivation`), with its dates as `Date`. */
export function getMainCultivationOfField(
  fieldInput: Pick<PhosphateFieldInput, "cultivations">,
  year: number,
): PhosphateFieldInput["cultivations"][number] | undefined {
  const main = getMainCultivation(
    fieldInput.cultivations.map((c) => ({
      ...c,
      b_lu_start: c.b_lu_start ? new Date(c.b_lu_start) : null,
      b_lu_end: c.b_lu_end ? new Date(c.b_lu_end) : null,
    })),
    year,
  )
  return main ? fieldInput.cultivations.find((c) => c.b_lu === main.b_lu) : undefined
}

/**
 * Whether a field is grassland in a year: its main cultivation (see `getMainCultivation`) is in the
 * `grass` rotation group. A grass catch crop or a sward that ends in spring does not make an arable
 * field grassland, so the sampling depth (0–10 cm) and the mineralisation factor stay those of arable
 * land.
 */
export function isGrasslandInYear(
  fieldInput: Pick<PhosphateFieldInput, "cultivations">,
  year: number,
): boolean {
  return getMainCultivationOfField(fieldInput, year)?.b_lu_croprotation === "grass"
}

/**
 * The balance terms of a field for one timeframe (kg P2O5 / ha): supply, removal and balance, with
 * the leaching from its surplus. Used for the selected year and for each earlier year of the
 * long-term average.
 *
 * @param fieldInput - The field input of the timeframe.
 * @param fertilizerDetails - The fertilizer details by `p_id_catalogue`.
 * @param cultivationDetails - The cultivation details by `b_lu_catalogue`.
 * @param timeFrame - The timeframe.
 * @param saturation - The phosphorus saturation of the field (for the leaching).
 * @param threshold - The PSD threshold of the field (for the leaching).
 * @param warnings - Receives the missing data that make the balance incomplete.
 * @returns The supply, removal, balance and leaching of the timeframe.
 */
export function calculatePhosphateFieldTerms(
  fieldInput: PhosphateFieldInput,
  fertilizerDetails: Map<string, PhosphateFertilizerDetail>,
  cultivationDetails: Map<string, PhosphateCultivationDetail>,
  timeFrame: { start: Date; end: Date },
  saturation: PhosphateSaturation,
  threshold: PhosphateSaturationThreshold,
  warnings: string[],
) {
  const isGrassland = isGrasslandInYear(fieldInput, yearOfTimeFrame(timeFrame))
  const supply = calculatePhosphateSupply(
    fieldInput,
    fertilizerDetails,
    cultivationDetails,
    isGrassland,
    timeFrame,
  )
  const removal = calculatePhosphateRemoval(fieldInput, cultivationDetails, timeFrame, warnings)
  const balance = supply.total.add(removal.total)
  const leaching = calculatePhosphateLeaching(balance, saturation, threshold)
  return { isGrassland, supply, removal, balance, leaching }
}
