import {
  calculateDose,
  calculateNitrogenBalance,
  calculateOrganicMatterBalance,
  calculatePhosphateBalance,
  collectInputForNitrogenBalance,
  collectInputForOrganicMatterBalance,
  collectInputForPhosphateBalance,
  createFunctionsForFertilizerApplicationFilling,
  createFunctionsForNorms,
  type GebruiksnormResult,
  getNitrogenBalanceField,
  getNutrientAdvice,
  getOrganicMatterBalanceField,
  getPhosphateBalanceField,
  getSoilParameterEstimates,
  GROENE_BRAAK,
  type NitrogenBalanceFieldResultNumeric,
  type NitrogenBalanceNumeric,
  type NormFilling,
  type NutrientAdvice,
  type OrganicMatterBalanceFieldResultNumeric,
  type OrganicMatterBalanceNumeric,
  type PhosphateBalance,
  type PhosphateBalanceFieldResult,
  type PhosphateBalanceInput,
  type PhosphateFieldInput,
} from "@nmi-agro/fdm-calculator"
import {
  type FdmType,
  type Field,
  type fdmSchema,
  getCultivations,
  getCultivationsFromCatalogue,
  getCurrentSoilData,
  getFertilizerApplications,
  getFertilizers,
  getField,
  type PrincipalId,
  type Timeframe,
} from "@nmi-agro/fdm-core"
import { getMainCultivation } from "~/lib/hoofdteelt.server"
import { getNmiApiKey } from "./nmi.server"

type OrganicMatterFieldInput = Awaited<
  ReturnType<typeof collectInputForOrganicMatterBalance>
>["fields"][number]

function getRequiredTimeFrame(timeframe: Timeframe): {
  start: Date
  end: Date
} {
  if (!timeframe.start || !timeframe.end) {
    throw new Error("Timeframe start and end must be provided")
  }

  return {
    start: timeframe.start,
    end: timeframe.end,
  }
}

export type FieldNormValues = {
  manure: GebruiksnormResult
  phosphate: GebruiksnormResult
  nitrogen: GebruiksnormResult
  renure?: GebruiksnormResult
}

export type FieldNormFillings = {
  manure: NormFilling
  phosphate: NormFilling
  nitrogen: NormFilling
  renure?: NormFilling
}

export async function getFieldNormValues({
  fdm,
  principal_id,
  b_id,
  calendar,
}: {
  fdm: FdmType
  principal_id: PrincipalId
  b_id: Field["b_id"]
  calendar: "2025" | "2026"
}): Promise<FieldNormValues> {
  if (calendar === "2026") {
    const functionsForNorms = createFunctionsForNorms("NL", "2026")
    const normsInput = await functionsForNorms.collectInputForNorms(fdm, principal_id, b_id)
    const [manure, phosphate, nitrogen, renure] = await Promise.all([
      (
        functionsForNorms.calculateNormForManure as (
          fdm: FdmType,
          input: typeof normsInput,
        ) => Promise<GebruiksnormResult>
      )(fdm, normsInput),
      (
        functionsForNorms.calculateNormForPhosphate as (
          fdm: FdmType,
          input: typeof normsInput,
        ) => Promise<GebruiksnormResult>
      )(fdm, normsInput),
      (
        functionsForNorms.calculateNormForNitrogen as (
          fdm: FdmType,
          input: typeof normsInput,
        ) => Promise<GebruiksnormResult>
      )(fdm, normsInput),
      (
        functionsForNorms.calculateNormForRenure as (
          fdm: FdmType,
          input: typeof normsInput,
        ) => Promise<GebruiksnormResult>
      )(fdm, normsInput),
    ])

    return { manure, phosphate, nitrogen, renure }
  }

  const functionsForNorms = createFunctionsForNorms("NL", "2025")
  const normsInput = await functionsForNorms.collectInputForNorms(fdm, principal_id, b_id)
  const [manure, phosphate, nitrogen] = await Promise.all([
    (
      functionsForNorms.calculateNormForManure as (
        fdm: FdmType,
        input: typeof normsInput,
      ) => Promise<GebruiksnormResult>
    )(fdm, normsInput),
    (
      functionsForNorms.calculateNormForPhosphate as (
        fdm: FdmType,
        input: typeof normsInput,
      ) => Promise<GebruiksnormResult>
    )(fdm, normsInput),
    (
      functionsForNorms.calculateNormForNitrogen as (
        fdm: FdmType,
        input: typeof normsInput,
      ) => Promise<GebruiksnormResult>
    )(fdm, normsInput),
  ])

  return { manure, phosphate, nitrogen }
}

async function getFieldNormFillings({
  fdm,
  principal_id,
  b_id,
  calendar,
  phosphateNorm,
}: {
  fdm: FdmType
  principal_id: PrincipalId
  b_id: Field["b_id"]
  calendar: "2025" | "2026"
  phosphateNorm: number
}): Promise<FieldNormFillings> {
  if (calendar === "2026") {
    const functionsForFilling = createFunctionsForFertilizerApplicationFilling("NL", "2026")
    const fillingInput = await functionsForFilling.collectInputForFertilizerApplicationFilling(
      fdm,
      principal_id,
      b_id,
      phosphateNorm,
    )
    const [manure, phosphate, nitrogen, renure] = await Promise.all([
      functionsForFilling.calculateFertilizerApplicationFillingForManure(fdm, fillingInput),
      functionsForFilling.calculateFertilizerApplicationFillingForPhosphate(fdm, fillingInput),
      functionsForFilling.calculateFertilizerApplicationFillingForNitrogen(fdm, fillingInput),
      functionsForFilling.calculateFertilizerApplicationFillingForRenure(fdm, fillingInput),
    ])

    return { manure, phosphate, nitrogen, renure }
  }

  const functionsForFilling = createFunctionsForFertilizerApplicationFilling("NL", "2025")
  const fillingInput = await functionsForFilling.collectInputForFertilizerApplicationFilling(
    fdm,
    principal_id,
    b_id,
    phosphateNorm,
  )
  const [manure, phosphate, nitrogen] = await Promise.all([
    functionsForFilling.calculateFertilizerApplicationFillingForManure(fdm, fillingInput),
    functionsForFilling.calculateFertilizerApplicationFillingForPhosphate(fdm, fillingInput),
    functionsForFilling.calculateFertilizerApplicationFillingForNitrogen(fdm, fillingInput),
  ])

  return { manure, phosphate, nitrogen }
}

// Get nitrogen balance for a field
export async function getNitrogenBalanceForField({
  fdm,
  principal_id,
  b_id_farm,
  b_id,
  timeframe,
  useEffectiveNitrogen = false,
}: {
  fdm: FdmType
  principal_id: PrincipalId
  b_id_farm: fdmSchema.farmsTypeSelect["b_id_farm"]
  b_id: Field["b_id"]
  timeframe: Timeframe
  useEffectiveNitrogen?: boolean
}): Promise<NitrogenBalanceFieldResultNumeric> {
  const { fields, ...rest } = await collectInputForNitrogenBalance(
    fdm,
    principal_id,
    b_id_farm,
    timeframe,
    b_id,
  )

  if (fields.length === 0) {
    throw new Error(`Field ${b_id} not found for farm ${b_id_farm}`)
  }

  const nitrogenBalanceResult = await getNitrogenBalanceField(fdm, {
    fieldInput: fields[0],
    ...rest,
    useEffectiveNitrogen,
  })
  return {
    b_id: b_id,
    b_area: fields[0].field.b_area ?? 0,
    b_bufferstrip: fields[0].field.b_bufferstrip ?? false,
    balance: nitrogenBalanceResult,
  }
}

export async function getNitrogenBalanceForFarm({
  fdm,
  principal_id,
  b_id_farm,
  timeframe,
  useEffectiveNitrogen = false,
}: {
  fdm: FdmType
  principal_id: PrincipalId
  b_id_farm: fdmSchema.farmsTypeSelect["b_id_farm"]
  timeframe: Timeframe
  useEffectiveNitrogen?: boolean
}): Promise<NitrogenBalanceNumeric> {
  const input = await collectInputForNitrogenBalance(fdm, principal_id, b_id_farm, timeframe)

  return calculateNitrogenBalance(fdm, { ...input, useEffectiveNitrogen })
}

// Get organic matter balance for a field
export async function getOrganicMatterBalanceForField({
  fdm,
  principal_id,
  b_id_farm,
  b_id,
  timeframe,
}: {
  fdm: FdmType
  principal_id: PrincipalId
  b_id_farm: fdmSchema.farmsTypeSelect["b_id_farm"]
  b_id: Field["b_id"]
  timeframe: Timeframe
}): Promise<{
  fieldResult: OrganicMatterBalanceFieldResultNumeric
  fieldInput: OrganicMatterFieldInput
}> {
  const { fields, ...rest } = await collectInputForOrganicMatterBalance(
    fdm,
    principal_id,
    b_id_farm,
    timeframe,
    b_id,
  )

  if (fields.length === 0) {
    throw new Error(`Field ${b_id} not found for farm ${b_id_farm}`)
  }

  const fieldInput = fields[0]
  const organicMatterBalanceResult = await getOrganicMatterBalanceField(fdm, {
    fieldInput,
    ...rest,
    timeFrame: getRequiredTimeFrame(rest.timeFrame),
  })
  return {
    fieldResult: {
      b_id: b_id,
      b_area: fieldInput.field.b_area ?? 0,
      b_bufferstrip: fieldInput.field.b_bufferstrip ?? false,
      balance: organicMatterBalanceResult,
    },
    fieldInput,
  }
}

export async function getOrganicMatterBalanceForFarm({
  fdm,
  principal_id,
  b_id_farm,
  timeframe,
}: {
  fdm: FdmType
  principal_id: PrincipalId
  b_id_farm: fdmSchema.farmsTypeSelect["b_id_farm"]
  timeframe: Timeframe
}): Promise<OrganicMatterBalanceNumeric> {
  const input = await collectInputForOrganicMatterBalance(fdm, principal_id, b_id_farm, timeframe)

  return calculateOrganicMatterBalance(fdm, {
    ...input,
    timeFrame: getRequiredTimeFrame(input.timeFrame),
  })
}

/** Number of earlier years of crop history added for the long-term phosphate balance. */
const PHOSPHATE_CROP_HISTORY_YEARS = 4

/**
 * Adds the crop history of the last years (BRP, from the NMI soil estimates that the field dashboard
 * also uses) to the fields of a phosphate balance input, so the long-term average also covers years
 * without registered cultivations. The estimates are cached per location. Without an NMI API key, or
 * when a request fails, the input is returned unchanged for that field.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - The principal (for the cultivation catalogue).
 * @param b_id_farm - The farm (for the cultivation catalogue).
 * @param input - The phosphate balance input.
 * @returns The input with `cultivation_history` per field and the catalogue details it needs.
 */
export async function addPhosphateCropHistory<T extends PhosphateBalanceInput>(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: fdmSchema.farmsTypeSelect["b_id_farm"],
  input: T,
): Promise<T> {
  const nmiApiKey = getNmiApiKey()
  if (!nmiApiKey) return input
  const middle = new Date((input.timeFrame.start.getTime() + input.timeFrame.end.getTime()) / 2)
  const year = middle.getFullYear()

  const fields: PhosphateBalanceInput["fields"] = []
  const batchSize = 10
  for (let i = 0; i < input.fields.length; i += batchSize) {
    const batch = await Promise.all(
      input.fields.slice(i, i + batchSize).map(async (fieldInput) => {
        const centroid = (fieldInput.field as { b_centroid?: [number, number] | null }).b_centroid
        if (fieldInput.field.b_bufferstrip || !centroid) return fieldInput
        try {
          const [a_lon, a_lat] = centroid
          const estimates = await getSoilParameterEstimates(fdm, { a_lat, a_lon, nmiApiKey })
          const cultivation_history = estimates.cultivations
            .filter((c) => c.year < year && c.year >= year - PHOSPHATE_CROP_HISTORY_YEARS)
            .map((c) => ({ year: c.year, b_lu_catalogue: `nl_${c.b_lu_brp}` }))
          return cultivation_history.length > 0
            ? { ...fieldInput, cultivation_history }
            : fieldInput
        } catch {
          return fieldInput
        }
      }),
    )
    fields.push(...batch)
  }

  // Make sure the catalogue details of the history crops are available
  const known = new Set(input.cultivationDetails.map((d) => d.b_lu_catalogue))
  const needed = new Set(
    fields.flatMap((f) => (f.cultivation_history ?? []).map((c) => c.b_lu_catalogue)),
  )
  let cultivationDetails = input.cultivationDetails
  if ([...needed].some((id) => !known.has(id))) {
    const catalogue = await getCultivationsFromCatalogue(fdm, principal_id, b_id_farm)
    cultivationDetails = [
      ...cultivationDetails,
      ...catalogue.filter((c) => needed.has(c.b_lu_catalogue) && !known.has(c.b_lu_catalogue)),
    ]
  }
  return { ...input, fields, cultivationDetails }
}

// Get phosphate balance for a field (prototype, see FDM-305)
export async function getPhosphateBalanceForField({
  fdm,
  principal_id,
  b_id_farm,
  b_id,
  timeframe,
}: {
  fdm: FdmType
  principal_id: PrincipalId
  b_id_farm: fdmSchema.farmsTypeSelect["b_id_farm"]
  b_id: Field["b_id"]
  timeframe: Timeframe
}): Promise<{
  fieldResult: PhosphateBalanceFieldResult
  fieldInput: PhosphateFieldInput
}> {
  const { fields, ...rest } = await addPhosphateCropHistory(
    fdm,
    principal_id,
    b_id_farm,
    await collectInputForPhosphateBalance(fdm, principal_id, b_id_farm, timeframe, b_id),
  )

  if (fields.length === 0) {
    throw new Error(`Field ${b_id} not found for farm ${b_id_farm}`)
  }

  const fieldInput = fields[0]
  const { history: historyYears, ...details } = rest
  const history = (historyYears ?? []).flatMap((year) =>
    year.fields
      .filter((f) => f.field.b_id === b_id)
      .map((past) => ({ timeFrame: year.timeFrame, fieldInput: past })),
  )
  const base = {
    b_id: b_id,
    b_area: fieldInput.field.b_area ?? 0,
    b_bufferstrip: fieldInput.field.b_bufferstrip ?? false,
  }
  try {
    const balance = await getPhosphateBalanceField(fdm, {
      fieldInput,
      ...details,
      ...(history.length > 0 ? { history } : {}),
    })
    return { fieldResult: { ...base, balance }, fieldInput }
  } catch (error) {
    return {
      fieldResult: {
        ...base,
        errorMessage: error instanceof Error ? error.message : String(error),
      },
      fieldInput,
    }
  }
}

// Get phosphate balance for a farm (prototype, see FDM-305)
export async function getPhosphateBalanceForFarm({
  fdm,
  principal_id,
  b_id_farm,
  timeframe,
}: {
  fdm: FdmType
  principal_id: PrincipalId
  b_id_farm: fdmSchema.farmsTypeSelect["b_id_farm"]
  timeframe: Timeframe
}): Promise<PhosphateBalance> {
  const input = await addPhosphateCropHistory(
    fdm,
    principal_id,
    b_id_farm,
    await collectInputForPhosphateBalance(fdm, principal_id, b_id_farm, timeframe),
  )
  return calculatePhosphateBalance(fdm, input)
}

export async function getNutrientAdviceForField({
  fdm,
  principal_id,
  b_id,
  b_centroid,
  timeframe,
  calendar,
}: {
  fdm: FdmType
  principal_id: PrincipalId
  b_id: Field["b_id"]
  b_centroid: Field["b_centroid"]
  timeframe: Timeframe
  calendar: string
}): Promise<NutrientAdvice> {
  const nmiApiKey = getNmiApiKey()

  const currentSoilData = await getCurrentSoilData(fdm, principal_id, b_id)

  const field = await getField(fdm, principal_id, b_id)

  const cultivations = await getCultivations(fdm, principal_id, b_id, timeframe)
  let b_lu_catalogue: string | null

  if (!cultivations.length) {
    b_lu_catalogue = GROENE_BRAAK // Set to 'braak' when no cultivation is present
  } else {
    const mainCultivation = getMainCultivation(cultivations, calendar)
    b_lu_catalogue = mainCultivation?.b_lu_catalogue ?? GROENE_BRAAK
  }

  const nutrientAdvice = await getNutrientAdvice(fdm, {
    b_lu_catalogue: b_lu_catalogue,
    b_centroid: b_centroid,
    currentSoilData: currentSoilData,
    nmiApiKey: nmiApiKey,
    b_bufferstrip: field.b_bufferstrip,
  })

  return nutrientAdvice
}

export async function getNorms({
  fdm,
  principal_id,
  b_id,
  calendar,
}: {
  fdm: FdmType
  principal_id: PrincipalId
  b_id: Field["b_id"]
  calendar: "2025" | "2026"
}) {
  const value = await getFieldNormValues({
    fdm,
    principal_id,
    b_id,
    calendar,
  })
  const filling = await getFieldNormFillings({
    fdm,
    principal_id,
    b_id,
    calendar,
    phosphateNorm: value.phosphate.normValue,
  })

  return {
    value,
    filling,
  }
}

export async function getPlannedDosesForField({
  fdm,
  principal_id,
  b_id,
  b_id_farm,
  timeframe,
}: {
  fdm: FdmType
  principal_id: PrincipalId
  b_id: Field["b_id"]
  b_id_farm: fdmSchema.farmsTypeSelect["b_id_farm"]
  timeframe: Timeframe
}) {
  const [applications, fertilizers] = await Promise.all([
    getFertilizerApplications(fdm, principal_id, b_id, timeframe),
    getFertilizers(fdm, principal_id, b_id_farm),
  ])

  const dosesResult = calculateDose({
    applications: applications,
    fertilizers: fertilizers,
  })

  return {
    doses: dosesResult,
    applications,
    fertilizers,
  }
}
