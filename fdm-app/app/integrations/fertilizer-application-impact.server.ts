import type { Dose } from "@nmi-agro/fdm-calculator"
import {
  calculateDose,
  calculateNitrogenBalance,
  collectInputForNitrogenBalance,
  type FieldInput,
  getNutrientAdvice,
  getRegion,
  type NitrogenBalanceInput,
} from "@nmi-agro/fdm-calculator"
import {
  type FdmType,
  type Fertilizer,
  type Field,
  getCultivationsForFarm,
  getCurrentSoilDataForFarm,
  getFertilizerApplicationsForFarm,
  getFertilizers,
  type Timeframe,
  toKgPerHa,
} from "@nmi-agro/fdm-core"
import type {
  BulkBlockResult,
  BulkFarmNorms,
  BulkFieldAdvice,
  BulkFieldIssue,
  BulkNutrientValues,
  BulkPreviewFieldNorms,
  BulkPreviewInput,
} from "~/components/blocks/fertilizer-applications/bulk/types"
import { toFriendlyAdviceError } from "~/components/blocks/nutrient-advice/overview-errors"
import { reportError } from "~/lib/error"
import { getMainCultivation } from "~/lib/hoofdteelt.server"
import { withTiming } from "~/lib/timing.server"
import {
  calculateFarmNorms,
  collectFarmNormsContext,
  type FarmNormsContext,
  type FarmNormsResult,
  isNormsCalendar,
} from "./farm-norms.server"
import { getNmiApiKey } from "./nmi.server"

/** Cap on simultaneous nutrient advice requests, so large selections don't overload the NMI API. */
const NUTRIENT_ADVICE_CONCURRENCY = 4

/** Name of the PostHog event that records the load times of the blocks. */
const TIMING_EVENT = "fertilizer_bulk_impact_timing"

type FarmField = Pick<Field, "b_id" | "b_name" | "b_area" | "b_bufferstrip" | "b_centroid">

interface ImpactContext {
  fdm: FdmType
  principal_id: string
  b_id_farm: string
  calendar: string
  timeframe: Timeframe
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

/** Wraps a block calculation so a failure of the whole block is reported and shown as a message. */
async function toBlockResult<T>(fn: () => Promise<T>): Promise<BulkBlockResult<T>> {
  try {
    return { status: "ok", data: await fn() }
  } catch (error) {
    reportError(error, { scope: "fertilizer-application-impact" })
    return { status: "error", message: "Berekening is mislukt. Probeer het later opnieuw." }
  }
}

function pickNutrients(dose: Dose): BulkNutrientValues {
  // Workable nitrogen is compared with the nitrogen advice
  return { n: dose.p_dose_nw, p: dose.p_dose_p, k: dose.p_dose_k }
}

function toFieldIssues(fields: FarmField[], result: FarmNormsResult): BulkFieldIssue[] {
  const names = new Map(fields.map((field) => [field.b_id, field.b_name]))
  return result.fieldNorms
    .filter((field) => field.errorMessage)
    .map((field) => ({
      b_id: field.b_id,
      b_name: names.get(field.b_id) ?? field.b_id,
      message: field.errorMessage as string,
      isWarning: field.isWarning,
    }))
}

/** Number of fields whose soil region is looked up at the same time. */
const REGION_CONCURRENCY = 8

/**
 * Starts the calculations for the current state of the bulk fertilizer application page.
 *
 * The blocks are returned as separate, un-awaited promises so they can be streamed to the page
 * independently. They use the cached calculator functions. The input of the farm is collected
 * once and shared by the blocks:
 *
 * - Farm norms cover **all** fields of the farm, because the norms apply to the farm as a whole.
 * - Advice and nitrogen balance cover the **selected** fields only.
 * - `previewInput` holds everything the browser needs to calculate the effect of an unsaved
 *   application on the selected fields, so the preview needs no request per change.
 *
 * @param params.farmFields - All fields of the farm in the calendar year.
 * @param params.selectedFieldIds - The fields selected on the page.
 */
export function loadBulkCurrentState({
  farmFields,
  selectedFieldIds,
  ...context
}: ImpactContext & {
  farmFields: FarmField[]
  selectedFieldIds: string[]
}) {
  const { fdm, principal_id, b_id_farm, calendar, timeframe } = context
  const selected = new Set(selectedFieldIds)
  const selectedFields = farmFields.filter((field) => selected.has(field.b_id))
  const timing = { b_id_farm, field_count: selectedFields.length }

  // Shared input, collected once for all blocks
  const fertilizersPromise = getFertilizers(fdm, principal_id, b_id_farm)
  const applicationsPromise = getFertilizerApplicationsForFarm(
    fdm,
    principal_id,
    b_id_farm,
    timeframe,
  )
  const normsPromise = isNormsCalendar(calendar)
    ? collectFarmNormsContext({ ...context, calendar, fields: farmFields }).then(
        async (normsContext) => ({
          normsContext,
          result: await calculateFarmNorms(fdm, normsContext),
        }),
      )
    : Promise.resolve(undefined)
  const balanceInputPromise =
    selectedFields.length > 0
      ? collectInputForNitrogenBalance(fdm, principal_id, b_id_farm, timeframe).then(
          (input): NitrogenBalanceInput => ({
            ...input,
            fields: input.fields.filter((field) => selected.has(field.field.b_id)),
          }),
        )
      : Promise.resolve(undefined)
  // A rejection is reported by the blocks that use these promises
  for (const promise of [
    fertilizersPromise,
    applicationsPromise,
    normsPromise,
    balanceInputPromise,
  ]) {
    promise.catch(() => undefined)
  }

  const farmNorms = withTiming(principal_id, TIMING_EVENT, { ...timing, block: "norms" }, () =>
    toBlockResult(async () => toFarmNorms(calendar, farmFields, await normsPromise, selected)),
  )
  const advice = withTiming(principal_id, TIMING_EVENT, { ...timing, block: "advice" }, () =>
    toBlockResult(() =>
      loadSelectionAdvice(context, selectedFields, {
        fertilizersPromise,
        applicationsPromise,
      }),
    ),
  )
  const balance = withTiming(principal_id, TIMING_EVENT, { ...timing, block: "balance" }, () =>
    toBlockResult(async () => {
      const input = await balanceInputPromise
      if (!input || input.fields.length === 0) return []
      return (await calculateNitrogenBalance(fdm, input)).fields
    }),
  )
  const previewInput = withTiming(
    principal_id,
    TIMING_EVENT,
    { ...timing, block: "preview_input" },
    () =>
      toBlockResult(async () =>
        buildPreviewInput({
          timeframe,
          calendar,
          selectedFields,
          fertilizers: await fertilizersPromise,
          applicationsByField: await applicationsPromise,
          // Norms and balance report their own failure; the rest of the preview still loads
          norms: await normsPromise.catch(() => undefined),
          balanceInput: await balanceInputPromise.catch(() => undefined),
        }),
      ),
  )

  return { farmNorms, advice, balance, previewInput }
}

function toFarmNorms(
  calendar: string,
  farmFields: FarmField[],
  norms: { result: FarmNormsResult } | undefined,
  selectedFieldIds: Set<string>,
): BulkFarmNorms {
  if (!norms) {
    return { available: false, showRenure: false, fieldCount: farmFields.length, fieldIssues: [] }
  }
  return {
    available: true,
    showRenure: Number.parseInt(calendar, 10) >= 2026,
    farmNorms: norms.result.farmNorms,
    farmFillings: norms.result.farmFillings,
    fieldCount: farmFields.length,
    fieldIssues: toFieldIssues(farmFields, norms.result),
    selectedFields: Object.fromEntries(
      norms.result.fieldNorms.flatMap((field) => {
        if (!selectedFieldIds.has(field.b_id) || !field.norms) return []
        const { norms: values, normsFilling: fillings } = field
        return [
          [
            field.b_id,
            {
              norms: {
                nitrogen: values.nitrogen.normValue,
                phosphate: values.phosphate.normValue,
                manure: values.manure.normValue,
                renure: values.renure?.normValue,
              },
              fillings: {
                nitrogen: fillings?.nitrogen.normFilling,
                phosphate: fillings?.phosphate.normFilling,
                manure: fillings?.manure.normFilling,
                renure: fillings?.renure?.normFilling,
              },
            },
          ],
        ]
      }),
    ),
  }
}

async function loadSelectionAdvice(
  { fdm, principal_id, b_id_farm, calendar, timeframe }: ImpactContext,
  fields: FarmField[],
  shared: {
    fertilizersPromise: Promise<Fertilizer[]>
    applicationsPromise: ReturnType<typeof getFertilizerApplicationsForFarm>
  },
): Promise<BulkFieldAdvice[]> {
  if (fields.length === 0) return []

  const [cultivationsByField, applicationsByField, soilDataByField, fertilizers] =
    await Promise.all([
      getCultivationsForFarm(fdm, principal_id, b_id_farm, timeframe),
      shared.applicationsPromise,
      getCurrentSoilDataForFarm(fdm, principal_id, b_id_farm, timeframe),
      shared.fertilizersPromise,
    ])
  const nmiApiKey = getNmiApiKey()

  const rows: BulkFieldAdvice[] = []
  for (const batch of chunk(fields, NUTRIENT_ADVICE_CONCURRENCY)) {
    const results = await Promise.all(
      batch.map(async (field): Promise<BulkFieldAdvice> => {
        const base = {
          b_id: field.b_id,
          b_area: field.b_area ?? 0,
          b_bufferstrip: field.b_bufferstrip ?? false,
        }
        try {
          const doses = calculateDose({
            applications: applicationsByField.get(field.b_id) ?? [],
            fertilizers,
          })
          const dose = pickNutrients(doses.dose)
          const cultivations = cultivationsByField.get(field.b_id) ?? []
          if (cultivations.length === 0) {
            return { ...base, dose, errorMessage: "Geen gewas geregistreerd voor dit perceel." }
          }
          const mainCultivation = getMainCultivation(cultivations, calendar)
          if (!mainCultivation) {
            return { ...base, dose, errorMessage: "Geen hoofdteelt bepaald voor dit jaar." }
          }
          const advice = await getNutrientAdvice(fdm, {
            b_lu_catalogue: mainCultivation.b_lu_catalogue,
            b_centroid: field.b_centroid,
            currentSoilData: soilDataByField.get(field.b_id) ?? [],
            nmiApiKey,
            b_bufferstrip: field.b_bufferstrip,
          })
          return {
            ...base,
            dose,
            advice: { n: advice.d_n_req, p: advice.d_p_req, k: advice.d_k_req },
          }
        } catch (error) {
          return { ...base, errorMessage: toFriendlyAdviceError(error) }
        }
      }),
    )
    rows.push(...results)
  }
  return rows
}

/** Returns the factor from the display amount to kg/ha, or `null` when it cannot be converted. */
function getKgPerDisplayUnit(fertilizer: Fertilizer): number | null {
  try {
    // Same conversion as addFertilizerApplication; it is linear, so the factor is exact
    return toKgPerHa(1, fertilizer.p_app_amount_unit, fertilizer.p_density)
  } catch {
    return null
  }
}

/**
 * Builds the input to calculate the preview in the browser, from the input that the current-state
 * blocks already collected. Only the selected fields are included, to keep the page small.
 */
async function buildPreviewInput({
  timeframe,
  calendar,
  selectedFields,
  fertilizers,
  applicationsByField,
  norms,
  balanceInput,
}: {
  timeframe: Timeframe
  calendar: string
  selectedFields: FarmField[]
  fertilizers: Fertilizer[]
  applicationsByField: Awaited<ReturnType<typeof getFertilizerApplicationsForFarm>>
  norms: { normsContext: FarmNormsContext; result: FarmNormsResult } | undefined
  balanceInput: NitrogenBalanceInput | undefined
}): Promise<BulkPreviewInput> {
  const kgPerDisplayUnit = Object.fromEntries(
    fertilizers.map((fertilizer) => [fertilizer.p_id, getKgPerDisplayUnit(fertilizer)]),
  )

  // Norm fillings: the filling input, the soil region and the current fillings per field
  let normsInput: BulkPreviewInput["norms"]
  if (norms && isNormsCalendar(calendar)) {
    const currentById = new Map(norms.result.fieldNorms.map((field) => [field.b_id, field]))
    const fields: Record<string, BulkPreviewFieldNorms> = {}
    for (const batch of chunk(selectedFields, REGION_CONCURRENCY)) {
      await Promise.all(
        batch.map(async (field) => {
          const input = norms.normsContext.fillingInputs.get(field.b_id)
          const current = currentById.get(field.b_id)?.normsFilling
          // Fields without a current filling are already listed as issues of the farm norms
          if (!input || !current) return
          try {
            const { fertilizers: _fertilizers, ...rest } = input
            fields[field.b_id] = {
              b_area: field.b_area ?? 0,
              b_region: await getRegion(field.b_centroid),
              input: rest as BulkPreviewFieldNorms["input"],
              current,
            }
          } catch (error) {
            // Without a region the field cannot be previewed; it keeps its current filling
            reportError(error, { scope: "fertilizer-application-impact", step: "region" })
          }
        }),
      )
    }
    normsInput = { year: calendar, fields }
  }

  // Nitrogen balance: the field input of the selected fields and the catalogue details they use
  let balance: BulkPreviewInput["balance"]
  if (balanceInput) {
    const usedFertilizers = new Set(fertilizers.map((fertilizer) => fertilizer.p_id_catalogue))
    const usedCultivations = new Set<string>()
    const fields: Record<string, FieldInput> = {}
    for (const fieldInput of balanceInput.fields) {
      for (const application of fieldInput.fertilizerApplications) {
        usedFertilizers.add(application.p_id_catalogue)
      }
      for (const cultivation of fieldInput.cultivations) {
        usedCultivations.add(cultivation.b_lu_catalogue)
      }
      const { b_id, b_centroid, b_area, b_start, b_end, b_bufferstrip } = fieldInput.field
      fields[fieldInput.field.b_id] = {
        ...fieldInput,
        // Only what the calculation uses; the geometry would make the page much larger
        field: { b_id, b_centroid, b_area, b_start, b_end, b_bufferstrip },
        // Decimal does not survive serialization to the page; the calculation accepts a number
        depositionSupply: fieldInput.depositionSupply
          ? ({
              total: Number(fieldInput.depositionSupply.total),
            } as unknown as FieldInput["depositionSupply"])
          : undefined,
      }
    }
    balance = {
      fields,
      fertilizerDetails: balanceInput.fertilizerDetails.filter((detail) =>
        usedFertilizers.has(detail.p_id_catalogue),
      ),
      cultivationDetails: balanceInput.cultivationDetails.filter((detail) =>
        usedCultivations.has(detail.b_lu_catalogue),
      ),
      timeFrame: balanceInput.timeFrame,
    }
  }

  const applications = Object.fromEntries(
    selectedFields.map((field) => [
      field.b_id,
      (applicationsByField.get(field.b_id) ?? []).map(
        ({ p_app_amount_display: _display, p_app_amount_unit: _unit, ...application }) =>
          application,
      ),
    ]),
  )

  return {
    fertilizers,
    kgPerDisplayUnit,
    applications,
    timeframe: { start: timeframe.start ?? null, end: timeframe.end ?? null },
    norms: normsInput,
    balance,
  }
}
