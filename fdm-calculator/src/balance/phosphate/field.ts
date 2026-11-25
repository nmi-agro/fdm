import Decimal from "decimal.js"
import type {
  PhosphateBalance,
  PhosphateBalanceField,
  PhosphateBalanceFieldInput,
  PhosphateBalanceFieldResult,
  PhosphateFieldInput,
} from "./types"
import { type FieldExclusionReason, getFieldExclusionReason } from "../../shared/field-exclusion"
import { convertDecimalToNumberRecursive } from "../shared/conversion"
import { getPhosphateSoilTypeParameters } from "./alpha-max"
import { calculatePhosphateLongTermBalance } from "./long-term"
import { calculatePhosphateProjection } from "./projection"
import { calculatePhosphateSaturation, calculatePhosphateSaturationThreshold } from "./saturation"
import { assessPhosphateStatus } from "./status"
import { determinePhosphateFrame } from "./target"
import { calculatePhosphateFieldTerms, getMainCultivationOfField, yearOfTimeFrame } from "./terms"

/**
 * Number of decimals of the results. Fewer than the whole numbers of the nitrogen balance, because
 * terms such as deposition (0.7 kg P2O5 / ha) and leaching are small.
 */
const PHOSPHATE_DECIMALS = 2

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
  const main = getMainCultivationOfField(fieldInput, yearOfTimeFrame(timeFrame))
  return getFieldExclusionReason({
    b_bufferstrip: fieldInput.field.b_bufferstrip,
    b_lu_croprotation: main?.b_lu_croprotation,
    b_lu_catalogue: main?.b_lu_catalogue,
  })
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
  input: PhosphateBalanceFieldInput,
): PhosphateBalanceField {
  const { fieldInput, timeFrame } = input
  const { field } = fieldInput
  const saturation = calculatePhosphateSaturation(fieldInput.soilAnalyses)
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

  // 1. Supply, removal, balance and leaching of the selected year
  const warnings: string[] = []
  const terms = calculatePhosphateFieldTerms(
    fieldInput,
    fertilizerDetails,
    cultivationDetails,
    timeFrame,
    saturation,
    threshold,
    warnings,
  )
  const { supply, removal } = terms

  // 2. Long-term average over this year and the earlier years with data (crop rotation)
  const long_term = calculatePhosphateLongTermBalance(
    input,
    terms,
    fertilizerDetails,
    cultivationDetails,
    saturation,
    threshold,
  )

  // 3. The effect of the long-term balance on the soil phosphorus stock
  const projection = calculatePhosphateProjection(
    long_term.balance + long_term.leaching,
    saturation,
    threshold,
    fieldInput.soilAnalyses,
    terms.isGrassland,
  )

  const { fertilizers } = supply
  const fertilizerType = (type: keyof typeof fertilizers.totals) => ({
    total: fertilizers.totals[type],
    applications: fertilizers.items
      .filter((item) => item.type === type)
      .map(({ id, value }) => ({ id, value })),
  })
  return convertDecimalToNumberRecursive(
    {
      b_id: field.b_id,
      b_area: field.b_area ?? 0,
      balance: terms.balance,
      supply: {
        total: supply.total,
        fertilizers: {
          total: fertilizers.total,
          mineral: fertilizerType("mineral"),
          manure: fertilizerType("manure"),
          compost: fertilizerType("compost"),
          other: fertilizerType("other"),
        },
        mineralization: supply.mineralization,
        deposition: supply.deposition,
      },
      removal: {
        total: removal.total,
        harvests: { total: removal.harvests.total, harvests: removal.harvests.items },
        residues: { total: removal.residues.total, cultivations: removal.residues.items },
      },
      leaching: terms.leaching,
      long_term,
      frame,
      saturation,
      projection,
      warnings: [...new Set(warnings)],
    },
    PHOSPHATE_DECIMALS,
  ) as PhosphateBalanceField
}

/**
 * Aggregates field results to the farm: the area-weighted average per ha of supply, removal,
 * balance and leaching, and the area per verdict of `assessPhosphateStatus`. Buffer strips, nature
 * and landscape elements (`exclusion`) and fields whose balance could not be calculated are excluded.
 *
 * @param fields - The results per field.
 * @param hasErrors - Whether the balance of one or more fields could not be calculated.
 * @param fieldErrorMessages - The error messages of the fields that failed.
 * @returns The farm balance.
 * @alpha
 */
export function calculatePhosphateBalancesFieldToFarm(
  fields: PhosphateBalanceFieldResult[],
  hasErrors: boolean,
  fieldErrorMessages: string[],
): PhosphateBalance {
  const counted = fields.filter(
    (f): f is PhosphateBalanceFieldResult & { balance: PhosphateBalanceField } =>
      f.balance !== undefined && !f.b_bufferstrip && f.b_area > 0,
  )
  const area = counted.reduce((a, f) => a.add(f.b_area), new Decimal(0))
  const weighted = (pick: (f: PhosphateBalanceField) => number) =>
    area.isZero()
      ? new Decimal(0)
      : counted
          .reduce((a, f) => a.add(new Decimal(pick(f.balance)).times(f.b_area)), new Decimal(0))
          .dividedBy(area)
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
  return convertDecimalToNumberRecursive(
    {
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
      hasErrors,
      fieldErrorMessages,
    },
    PHOSPHATE_DECIMALS,
  ) as PhosphateBalance
}
