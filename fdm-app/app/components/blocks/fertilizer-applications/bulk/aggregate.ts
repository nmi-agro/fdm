import {
  aggregateNutrientAdviceToFarmLevel,
  calculateNitrogenBalancesFieldToFarm,
  type NitrogenBalanceFieldNumeric,
  type NitrogenBalanceFieldResultNumeric,
  type NitrogenBalanceNumeric,
} from "@nmi-agro/fdm-calculator/browser"
import { computeAdviceProgress } from "~/components/blocks/nutrient-advice/progress-bar"
import { toFriendlyCalculationError } from "./errors"
import { formatKg } from "./status"
import {
  BULK_NUTRIENTS,
  type BulkFieldAdvice,
  type BulkFieldNormValues,
  type BulkFieldOption,
  type BulkNormKey,
  type BulkNormValues,
  type BulkNutrient,
  type BulkNutrientValues,
} from "./types"

/** Status of a field on the bulk page. Shown with an icon and text, never with colour alone. */
export type FieldImpactStatus =
  | "ok"
  | "under_advice"
  | "over_advice"
  | "over_target"
  | "missing_soil_data"
  | "bufferstrip"
  | "no_crop"
  | "no_advice"
  | "no_balance"

/** One row of the field table. All values are in kg/ha. */
export interface FieldImpactRow {
  b_id: string
  b_name: string
  b_area: number
  mainCultivationName: string | null
  mainCultivationCropRotation: string | null
  included: boolean
  /** `false` in the rotation flow when the field does not have the selected crop. */
  hasSelectedCrop: boolean
  advice?: BulkNutrientValues
  dose?: BulkNutrientValues
  /** Dose after the application, when a preview is available. */
  doseAfter?: BulkNutrientValues
  balance?: NitrogenBalanceFieldNumeric
  /** Balance after the application, when a preview is available. */
  balanceAfter?: NitrogenBalanceFieldNumeric
  statuses: FieldImpactStatus[]
  /** The nutrients below and above the advice, after the change when a preview is available. */
  adviceNutrients: { under: BulkNutrient[]; over: BulkNutrient[] }
  /** The legal norms of the field, in kg per ha (indicative per field). */
  norms?: BulkNormValues
  /** The current norm fillings, in kg per ha. */
  normFillings?: BulkNormValues
  /** The norm fillings after the change, when a preview is available. */
  normFillingsAfter?: BulkNormValues
  /** Messages that explain why (part of) the field is not calculated. */
  messages: string[]
}

const SOIL_DATA_PATTERN = /soil parameters|bodem/i

/**
 * Combines the field options, the current advice and balance, and the preview into table rows.
 *
 * @param fields - The selected fields.
 * @param included - The ids of the fields the application will be added to.
 * @param cultivationIds - In the rotation flow, the selected crop. Empty otherwise.
 */
export function buildFieldImpactRows({
  fields,
  included,
  cultivationIds,
  advice,
  balance,
  previewDoses,
  previewBalance,
  fieldNorms,
  previewNormFillings,
}: {
  fields: BulkFieldOption[]
  included: Set<string>
  cultivationIds: string[]
  advice?: BulkFieldAdvice[]
  balance?: NitrogenBalanceFieldResultNumeric[]
  /** Dose per changed field after the change, in kg/ha. */
  previewDoses?: Record<string, BulkNutrientValues>
  previewBalance?: NitrogenBalanceFieldResultNumeric[]
  /** The norms and current fillings per field, in kg per ha. */
  fieldNorms?: Record<string, BulkFieldNormValues>
  /** The norm fillings per changed field after the change, in kg per ha. */
  previewNormFillings?: Record<string, BulkNormValues>
}): FieldImpactRow[] {
  const adviceById = new Map(advice?.map((row) => [row.b_id, row]))
  const balanceById = new Map(balance?.map((row) => [row.b_id, row]))
  const previewBalanceById = new Map(previewBalance?.map((row) => [row.b_id, row]))

  return fields.map((field) => {
    const isIncluded = included.has(field.b_id)
    const adviceRow = adviceById.get(field.b_id)
    const balanceRow = balanceById.get(field.b_id)
    const previewBalanceRow = isIncluded ? previewBalanceById.get(field.b_id) : undefined
    const doseAfter = isIncluded ? previewDoses?.[field.b_id] : undefined

    const statuses: FieldImpactStatus[] = []
    const messages: string[] = []
    const adviceNutrients: FieldImpactRow["adviceNutrients"] = { under: [], over: [] }

    if (field.b_bufferstrip) {
      statuses.push("bufferstrip")
    } else if (field.cultivations.length === 0) {
      statuses.push("no_crop")
    } else {
      const errors = [adviceRow?.errorMessage, balanceRow?.errorMessage].filter(
        (message): message is string => Boolean(message),
      )
      messages.push(...new Set(errors.map(toFriendlyCalculationError)))
      if (errors.some((message) => SOIL_DATA_PATTERN.test(message))) {
        statuses.push("missing_soil_data")
      } else {
        // Name what could not be calculated, so it does not look like the whole row failed
        if (adviceRow?.errorMessage) statuses.push("no_advice")
        if (balanceRow?.errorMessage) statuses.push("no_balance")
      }

      // Too little is a risk for the yield; too much is wasteful and a risk for the environment
      const dose = doseAfter ?? adviceRow?.dose
      if (adviceRow?.advice && dose) {
        for (const nutrient of BULK_NUTRIENTS) {
          const { status } = computeAdviceProgress(dose[nutrient], adviceRow.advice[nutrient] ?? 0)
          if (status === "under") adviceNutrients.under.push(nutrient)
          if (status === "over") adviceNutrients.over.push(nutrient)
        }
        if (adviceNutrients.under.length > 0) statuses.push("under_advice")
        if (adviceNutrients.over.length > 0) statuses.push("over_advice")
      }
      const fieldBalance = previewBalanceRow?.balance ?? balanceRow?.balance
      if (fieldBalance && fieldBalance.balance > fieldBalance.target) {
        statuses.push("over_target")
      }
      if (statuses.length === 0 && adviceRow && balanceRow) statuses.push("ok")
    }

    return {
      b_id: field.b_id,
      b_name: field.b_name,
      b_area: field.b_area,
      mainCultivationName: field.mainCultivationName,
      mainCultivationCropRotation: field.mainCultivationCropRotation,
      included: isIncluded,
      hasSelectedCrop:
        cultivationIds.length === 0 || field.cultivations.some((c) => cultivationIds.includes(c)),
      advice: adviceRow?.advice,
      dose: adviceRow?.dose,
      doseAfter,
      balance: balanceRow?.balance,
      balanceAfter: previewBalanceRow?.balance,
      statuses,
      adviceNutrients,
      norms: fieldNorms?.[field.b_id]?.norms,
      normFillings: fieldNorms?.[field.b_id]?.fillings,
      normFillingsAfter: isIncluded ? previewNormFillings?.[field.b_id] : undefined,
      messages,
    }
  })
}

/** The area-weighted dose and advice of the included fields, in kg/ha. */
export interface AdviceSummary {
  advice: BulkNutrientValues
  dose: BulkNutrientValues
  doseAfter?: BulkNutrientValues
  /** Number of included fields that are part of the aggregation. */
  countedFields: number
  includedFields: number
}

function toValues(
  aggregated: Record<BulkNutrient, { dose: number; advice: number }>,
  key: "dose" | "advice",
): BulkNutrientValues {
  return {
    n: aggregated.n[key],
    p: aggregated.p[key],
    k: aggregated.k[key],
  }
}

/**
 * Aggregates the advice and dose of the included fields to an area-weighted average per ha.
 * Buffer strips and fields without advice are left out. The dose after the application is only
 * returned when the preview covers every counted field.
 */
export function summarizeAdvice(rows: FieldImpactRow[]): AdviceSummary {
  const included = rows.filter((row) => row.included)
  const counted = included.filter(
    (row): row is FieldImpactRow & { advice: BulkNutrientValues; dose: BulkNutrientValues } =>
      !row.statuses.includes("bufferstrip") && Boolean(row.advice && row.dose),
  )

  const current = aggregateNutrientAdviceToFarmLevel(
    counted.map((row) => ({
      b_area: row.b_area,
      values: Object.fromEntries(
        BULK_NUTRIENTS.map((n) => [n, { dose: row.dose[n], advice: row.advice[n] }]),
      ) as Record<BulkNutrient, { dose: number; advice: number }>,
    })),
    BULK_NUTRIENTS,
    "per_ha",
  )

  const hasPreview = counted.length > 0 && counted.every((row) => row.doseAfter)
  const after = hasPreview
    ? aggregateNutrientAdviceToFarmLevel(
        counted.map((row) => ({
          b_area: row.b_area,
          values: Object.fromEntries(
            BULK_NUTRIENTS.map((n) => [
              n,
              { dose: row.doseAfter?.[n] ?? 0, advice: row.advice[n] },
            ]),
          ) as Record<BulkNutrient, { dose: number; advice: number }>,
        })),
        BULK_NUTRIENTS,
        "per_ha",
      )
    : undefined

  return {
    advice: toValues(current, "advice"),
    dose: toValues(current, "dose"),
    doseAfter: after ? toValues(after, "dose") : undefined,
    countedFields: counted.length,
    includedFields: included.length,
  }
}

/** The area-weighted nitrogen balance of the included fields, in kg N/ha. */
export interface BalanceSummary {
  current: NitrogenBalanceNumeric
  after?: NitrogenBalanceNumeric
  countedFields: number
  includedFields: number
}

/**
 * Aggregates the nitrogen balance of the included fields to an area-weighted average per ha.
 * Buffer strips and fields without a balance are left out, as in the farm balance.
 */
export function summarizeBalance(rows: FieldImpactRow[]): BalanceSummary {
  const included = rows.filter((row) => row.included && !row.statuses.includes("bufferstrip"))
  const counted = included.filter((row) => row.balance)
  const toResult = (
    row: FieldImpactRow,
    balance: NitrogenBalanceFieldNumeric | undefined,
  ): NitrogenBalanceFieldResultNumeric => ({
    b_id: row.b_id,
    b_area: row.b_area,
    b_bufferstrip: false,
    balance,
  })

  const current = calculateNitrogenBalancesFieldToFarm(
    counted.map((row) => toResult(row, row.balance)),
    false,
    [],
  )
  const hasPreview = counted.length > 0 && counted.every((row) => row.balanceAfter)
  const after = hasPreview
    ? calculateNitrogenBalancesFieldToFarm(
        counted.map((row) => toResult(row, row.balanceAfter)),
        false,
        [],
      )
    : undefined

  return {
    current,
    after,
    countedFields: counted.length,
    includedFields: rows.filter((row) => row.included).length,
  }
}

/** A farm norm that is exceeded, or the room that is left, after the application. */
export interface NormOutcome {
  key: BulkNormKey
  /** Norm minus filling after the application, in kg. Negative when exceeded. */
  remaining: number
}

/**
 * Determines, for each farm norm that the application adds to, how much room is left or by how
 * much the norm is exceeded after the application.
 */
export function getNormOutcomes(
  norms: BulkNormValues,
  current: BulkNormValues,
  after: BulkNormValues,
  showRenure: boolean,
): NormOutcome[] {
  const keys: BulkNormKey[] = showRenure
    ? ["nitrogen", "phosphate", "manure", "renure"]
    : ["nitrogen", "phosphate", "manure"]
  return keys.flatMap((key) => {
    const norm = norms[key] ?? 0
    const added = (after[key] ?? 0) - (current[key] ?? 0)
    if (added <= 0) return []
    return [{ key, remaining: norm - (after[key] ?? 0) }]
  })
}

const NUTRIENT_NAMES: Record<BulkNutrient, string> = { n: "N", p: "P₂O₅", k: "K₂O" }

/**
 * Short, neutral notes about the agronomic effect of a change: whether the nitrogen balance ends
 * above its target and which fields end above the advice for a nutrient the change adds. Shown
 * near the save button next to the legal norms; they never block saving.
 *
 * @param rows - The field rows, with the preview applied.
 * @param balance - The aggregated nitrogen balance of the included fields.
 * @returns The notes, empty when there is no preview or nothing to mention.
 */
export function getAgronomicNotes(rows: FieldImpactRow[], balance: BalanceSummary): string[] {
  const changed = rows.filter((row) => row.included && (row.doseAfter || row.balanceAfter))
  if (changed.length === 0) return []
  const notes: string[] = []

  const after = balance.after
  if (after && after.balance > after.target) {
    const above = formatKg(after.balance - after.target)
    notes.push(
      balance.includedFields === 1
        ? `Stikstofbalans komt ${above} kg N/ha boven de streefwaarde.`
        : `Stikstofbalans komt gemiddeld ${above} kg N/ha boven de streefwaarde.`,
    )
  }

  // Only blame the application for nutrients it adds and that end up above the advice
  const overNutrients = (row: FieldImpactRow) =>
    BULK_NUTRIENTS.filter((n) => {
      const after = row.doseAfter?.[n]
      const advice = row.advice?.[n]
      if (after === undefined || advice === undefined) return false
      return after > (row.dose?.[n] ?? 0) && computeAdviceProgress(after, advice).status === "over"
    })
  const overAdvice = changed.filter((row) => overNutrients(row).length > 0)
  if (overAdvice.length > 0) {
    const nutrients = BULK_NUTRIENTS.filter((n) =>
      overAdvice.some((row) => overNutrients(row).includes(n)),
    ).map((n) => NUTRIENT_NAMES[n])
    notes.push(
      changed.length === 1
        ? `De gift komt boven het advies voor ${nutrients.join(", ")}.`
        : `${overAdvice.length} van ${changed.length} percelen ${overAdvice.length === 1 ? "komt" : "komen"} boven het advies voor ${nutrients.join(", ")}.`,
    )
  }
  return notes
}
