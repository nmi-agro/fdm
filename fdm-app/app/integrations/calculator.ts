import {
  calculateDose,
  calculateNitrogenBalance,
  calculateOrganicMatterBalance,
  collectInputForNitrogenBalance,
  collectInputForOrganicMatterBalance,
  createFunctionsForFertilizerApplicationFilling,
  createFunctionsForNorms,
  type GebruiksnormResult,
  getNitrogenBalanceField,
  getNutrientAdvice,
  getOrganicMatterBalanceField,
  type NitrogenBalanceFieldResultNumeric,
  type NitrogenBalanceNumeric,
  type NormFilling,
  type NutrientAdvice,
  type OrganicMatterBalanceFieldResultNumeric,
  type OrganicMatterBalanceNumeric,
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
import { getDefaultCultivation } from "~/lib/cultivation-helpers.server"
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
}

export type FieldNormFillings = {
  manure: NormFilling
  phosphate: NormFilling
  nitrogen: NormFilling
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
    const [manure, phosphate, nitrogen] = await Promise.all([
      functionsForFilling.calculateFertilizerApplicationFillingForManure(fdm, fillingInput),
      functionsForFilling.calculateFertilizerApplicationFillingForPhosphate(fdm, fillingInput),
      functionsForFilling.calculateFertilizerApplicationFillingForNitrogen(fdm, fillingInput),
    ])

    return { manure, phosphate, nitrogen }
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
}: {
  fdm: FdmType
  principal_id: PrincipalId
  b_id_farm: fdmSchema.farmsTypeSelect["b_id_farm"]
  b_id: Field["b_id"]
  timeframe: Timeframe
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
}: {
  fdm: FdmType
  principal_id: PrincipalId
  b_id_farm: fdmSchema.farmsTypeSelect["b_id_farm"]
  timeframe: Timeframe
}): Promise<NitrogenBalanceNumeric> {
  const input = await collectInputForNitrogenBalance(fdm, principal_id, b_id_farm, timeframe)

  return calculateNitrogenBalance(fdm, input)
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
    b_lu_catalogue = "nl_6794" // Set to 'braak' when no cultivation is present
  } else {
    const mainCultivation = getDefaultCultivation(cultivations, calendar) || cultivations[0]
    b_lu_catalogue = mainCultivation.b_lu_catalogue
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
