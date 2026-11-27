import {
  calculateDose,
  calculateNitrogenBalance,
  calculateOrganicMatterBalance,
  calculatePhosphateBalance,
  calculatePhosphateBalancesFieldToFarm,
  collectInputForNitrogenBalance,
  collectInputForOrganicMatterBalance,
  collectInputForPhosphateBalance,
  createFunctionsForFertilizerApplicationFilling,
  createFunctionsForNorms,
  type GebruiksnormResult,
  getNitrogenBalanceField,
  getNutrientAdvice,
  getOrganicMatterBalanceField,
  GROENE_BRAAK,
  type NitrogenBalanceFieldResultNumeric,
  type NitrogenBalanceNumeric,
  type NormFilling,
  type NormsYear,
  type NutrientAdvice,
  type OrganicMatterBalanceFieldResultNumeric,
  type OrganicMatterBalanceNumeric,
  type PhosphateBalance,
  type PhosphateBalanceFieldResult,
  type PhosphateFieldInput,
} from "@nmi-agro/fdm-calculator"
import {
  type FdmType,
  type Field,
  type fdmSchema,
  getCultivations,
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
  calendar: NormsYear
}): Promise<FieldNormValues> {
  // The norm functions of a year take the input of that same year; the union of all years
  // can't express that, so each function is called through this common signature.
  type NormFunction = (fdm: FdmType, input: object) => Promise<GebruiksnormResult>
  const functionsForNorms = createFunctionsForNorms("NL", calendar)
  const normsInput: object = await functionsForNorms.collectInputForNorms(fdm, principal_id, b_id)
  const calculate = (fn: unknown) => (fn as NormFunction)(fdm, normsInput)
  const [manure, phosphate, nitrogen, renure] = await Promise.all([
    calculate(functionsForNorms.calculateNormForManure),
    calculate(functionsForNorms.calculateNormForPhosphate),
    calculate(functionsForNorms.calculateNormForNitrogen),
    "calculateNormForRenure" in functionsForNorms
      ? calculate(functionsForNorms.calculateNormForRenure)
      : undefined,
  ])

  return renure ? { manure, phosphate, nitrogen, renure } : { manure, phosphate, nitrogen }
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
  calendar: NormsYear
  phosphateNorm: number
}): Promise<FieldNormFillings> {
  // See getFieldNormValues: each filling function is called through a common signature.
  type FillingFunction = (fdm: FdmType, input: object) => Promise<NormFilling>
  const functionsForFilling = createFunctionsForFertilizerApplicationFilling("NL", calendar)
  const fillingInput: object =
    await functionsForFilling.collectInputForFertilizerApplicationFilling(
      fdm,
      principal_id,
      b_id,
      phosphateNorm,
    )
  const calculate = (fn: unknown) => (fn as FillingFunction)(fdm, fillingInput)
  const [manure, phosphate, nitrogen, renure] = await Promise.all([
    calculate(functionsForFilling.calculateFertilizerApplicationFillingForManure),
    calculate(functionsForFilling.calculateFertilizerApplicationFillingForPhosphate),
    calculate(functionsForFilling.calculateFertilizerApplicationFillingForNitrogen),
    "calculateFertilizerApplicationFillingForRenure" in functionsForFilling
      ? calculate(functionsForFilling.calculateFertilizerApplicationFillingForRenure)
      : undefined,
  ])

  return renure ? { manure, phosphate, nitrogen, renure } : { manure, phosphate, nitrogen }
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

// Get phosphate balance for a field (experimental)
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
  const input = await collectInputForPhosphateBalance(
    fdm,
    principal_id,
    b_id_farm,
    timeframe,
    b_id,
    { nmiApiKey: getNmiApiKey() },
  )
  const { fields } = await calculatePhosphateBalance(fdm, input)
  if (input.fields.length === 0 || fields.length === 0) {
    throw new Error(`Field ${b_id} not found for farm ${b_id_farm}`)
  }
  return { fieldResult: fields[0], fieldInput: input.fields[0] }
}

// Get phosphate balance for a farm (experimental)
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
  const input = await collectInputForPhosphateBalance(
    fdm,
    principal_id,
    b_id_farm,
    timeframe,
    undefined,
    { nmiApiKey: getNmiApiKey() },
  )
  return calculatePhosphateBalance(fdm, input)
}

/**
 * Phosphate balance of a farm that could not be calculated: no fields, with the error message.
 *
 * @param errorMessage - Why the farm could not be calculated.
 * @returns The failed farm result.
 */
export function failedPhosphateFarmResult(errorMessage: string): PhosphateBalance {
  return {
    ...calculatePhosphateBalancesFieldToFarm([], true, [errorMessage]),
    errorMessage,
  }
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
  calendar: NormsYear
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
