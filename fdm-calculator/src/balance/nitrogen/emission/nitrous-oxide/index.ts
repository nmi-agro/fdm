/* eslint-disable typescript/restrict-template-expressions -- Values in error messages are formatted inside template strings on purpose. */
import type { BaseFertilizerApplication } from "@nmi-agro/fdm-core"
import { differenceInCalendarDays } from "date-fns"
import Decimal from "decimal.js"
import type {
  CultivationDetail,
  FertilizerDetail,
  FieldInput,
  NitrogenEmissionNitrousOxide,
  NitrogenEmissionNitrousOxideFarm,
  NitrogenEmissionNitrousOxideNumeric,
  SoilAnalysisPicked,
} from "../../types"
import { calculateNitrogenInCropResiduesLeft } from "../crop-residues"
import { determineLandTypeAtDate } from "../land-type"
import {
  EF_N2O_CROP_RESIDUES,
  EF_N2O_INDIRECT_LEACHING,
  EF_N2O_INDIRECT_VOLATILISATION,
  EF_N2O_MANURE,
  EF_N2O_MINERAL,
  EF_N2O_OTHER_ORGANIC,
  EF_N2O_SEWAGE_SLUDGE,
  GWP_N2O,
  N2O_N_TO_N2O,
  SEWAGE_SLUDGE_TYPES_RVO,
  SURFACE_APPLICATION_METHODS,
  YEARLY_N2O_ORGANIC_SOILS,
} from "./constants"

const fertilizerTypes = ["mineral", "manure", "compost", "other"] as const

/**
 * Calculates the nitrous oxide (N₂O) emission of a field according to the Dutch National Emission
 * Model for Agriculture (NEMA).
 *
 * The emission consists of:
 * - direct emission from fertilizer applications: total nitrogen applied × emission factor, which
 *   depends on the type of fertilizer, the application method (manure), the land use at the date of
 *   application and whether the soil is peat;
 * - direct emission from the nitrogen in the above-ground crop residues left on the field;
 * - direct emission from the mineralisation of peat (`veen`) and peaty soils (`moerige_klei`), a
 *   yearly value scaled to the length of the time frame;
 * - indirect emission from the nitrogen lost by ammonia volatilisation and by nitrate leaching of
 *   the field.
 *
 * The emission is an indicator: it is not part of the nitrogen balance. Following the other
 * nitrogen losses, the N₂O emission is negative (kg N₂O-N / ha). The CO₂-equivalent is positive,
 * as it is a greenhouse gas emission (kg CO₂-eq / ha).
 *
 * @param cultivations - The cultivations of the field.
 * @param harvests - The harvests of the field.
 * @param fertilizerApplications - The fertilizer applications on the field.
 * @param cultivationDetailsMap - A map of cultivation details, with the cultivation catalogue identifier as key.
 * @param fertilizerDetailsMap - A map of fertilizer details, with the fertilizer catalogue identifier as key.
 * @param soilAnalysis - The soil parameters of the field; `b_soiltype_agr` is used.
 * @param ammoniaEmission - The total ammonia emission of the field (kg N / ha, negative).
 * @param nitrateEmission - The nitrate leaching of the field (kg N / ha, negative).
 * @param timeFrame - The period of the calculation for this field. When the end is before the start,
 * the field has no overlap with the time frame and gets no emission from organic soils.
 * @returns The N₂O emission by source, the total N₂O emission and the CO₂-equivalent.
 * @throws {Error} If a fertilizer application has no fertilizer details, if a manure application has
 * no application method, or if a cultivation has no cultivation details.
 *
 * @example
 * ```ts
 * const nitrousOxide = calculateNitrogenEmissionViaNitrousOxide(
 *   cultivations,
 *   harvests,
 *   fertilizerApplications,
 *   cultivationDetailsMap,
 *   fertilizerDetailsMap,
 *   soilAnalysis,
 *   emission.ammonia.total,
 *   emission.nitrate.total,
 *   timeFrame,
 * )
 * // nitrousOxide.total: Decimal(-2.99), nitrousOxide.co2eq: Decimal(1245.1)
 * ```
 */
export function calculateNitrogenEmissionViaNitrousOxide(
  cultivations: FieldInput["cultivations"],
  harvests: FieldInput["harvests"],
  fertilizerApplications: FieldInput["fertilizerApplications"],
  cultivationDetailsMap: Map<string, CultivationDetail>,
  fertilizerDetailsMap: Map<string, FertilizerDetail>,
  soilAnalysis: Pick<SoilAnalysisPicked, "b_soiltype_agr">,
  ammoniaEmission: Decimal,
  nitrateEmission: Decimal,
  timeFrame: { start: Date; end: Date },
): NitrogenEmissionNitrousOxide {
  const isPeat = soilAnalysis.b_soiltype_agr === "veen"
  const emission = createEmptyNitrousOxideEmission()

  // Direct emission from fertilizer applications
  for (const application of fertilizerApplications) {
    const fertilizerDetail = fertilizerDetailsMap.get(application.p_id_catalogue)
    if (!fertilizerDetail) {
      throw new Error(
        `Fertilizer application ${application.p_app_id} has no fertilizerDetails for fertilizer ${application.p_id_catalogue}`,
      )
    }
    const nitrogenApplied = new Decimal(application.p_app_amount ?? 0)
      .times(fertilizerDetail.p_n_rt ?? 0)
      .dividedBy(1000) // Convert from g N to kg N
    const emissionFactor = determineNitrousOxideEmissionFactor(
      application,
      fertilizerDetail,
      cultivations,
      cultivationDetailsMap,
      isPeat,
    )
    const value = toEmission(nitrogenApplied.times(emissionFactor))

    const fertilizerType =
      fertilizerTypes.find((type) => type === fertilizerDetail.p_type) ?? "other"
    emission.fertilizers[fertilizerType].total =
      emission.fertilizers[fertilizerType].total.add(value)
    emission.fertilizers[fertilizerType].applications.push({ id: application.p_app_id, value })
    emission.fertilizers.total = emission.fertilizers.total.add(value)
  }

  // Direct emission from the nitrogen in the crop residues left on the field
  for (const cultivation of cultivations) {
    const cultivationDetail = cultivationDetailsMap.get(cultivation.b_lu_catalogue)
    if (!cultivationDetail) {
      throw new Error(
        `Cultivation ${cultivation.b_lu} has no corresponding cultivation in cultivationDetails`,
      )
    }
    const residueNitrogen = calculateNitrogenInCropResiduesLeft(
      cultivation,
      harvests,
      cultivationDetail,
    )
    const value = toEmission(residueNitrogen.times(EF_N2O_CROP_RESIDUES))
    emission.residues.total = emission.residues.total.add(value)
    emission.residues.cultivations.push({ id: cultivation.b_lu, value })
  }

  // Direct emission from the mineralisation of organic soils
  emission.soil.total = toEmission(
    calculateNitrousOxideEmissionOrganicSoil(soilAnalysis.b_soiltype_agr, timeFrame),
  )

  // Indirect emission from the nitrogen lost by ammonia volatilisation and nitrate leaching
  emission.indirect.volatilisation = toEmission(
    ammoniaEmission.abs().times(EF_N2O_INDIRECT_VOLATILISATION),
  )
  emission.indirect.leaching = toEmission(nitrateEmission.abs().times(EF_N2O_INDIRECT_LEACHING))
  emission.indirect.total = emission.indirect.volatilisation.add(emission.indirect.leaching)

  emission.total = emission.fertilizers.total
    .add(emission.residues.total)
    .add(emission.soil.total)
    .add(emission.indirect.total)
  emission.co2eq = convertNitrousOxideToCo2Equivalent(emission.total)

  return emission
}

/**
 * Determines the N₂O emission factor of a fertilizer application (kg N₂O-N per kg N applied),
 * according to NEMA WOT-283 (tables 2.7, 3.2 and 3.3).
 *
 * - Sewage sludge (`p_type_rvo` 113 or 114): 0.009.
 * - Manure: depends on the application method (surface spreading or low-emission application), the
 *   land use at the date of application and whether the soil is peat.
 * - Mineral fertilizer: depends on the land use at the date of application and whether the soil is peat.
 * - Compost and other fertilizers: 0.004.
 *
 * Bare soil is treated as cropland.
 *
 * @param application - The fertilizer application.
 * @param fertilizerDetail - The details of the applied fertilizer.
 * @param cultivations - The cultivations of the field, used to determine the land use.
 * @param cultivationDetailsMap - A map of cultivation details, with the cultivation catalogue identifier as key.
 * @param isPeat - Whether the soil of the field is peat (`veen`).
 * @returns The emission factor as a fraction.
 * @throws {Error} If a manure application has no application method, as in the ammonia emission.
 *
 * @example
 * ```ts
 * determineNitrousOxideEmissionFactor(application, fertilizerDetail, cultivations, cultivationDetailsMap, false)
 * // Decimal(0.013) for injected manure on cropland on mineral soil
 * ```
 */
export function determineNitrousOxideEmissionFactor(
  application: BaseFertilizerApplication,
  fertilizerDetail: FertilizerDetail,
  cultivations: FieldInput["cultivations"],
  cultivationDetailsMap: Map<string, CultivationDetail>,
  isPeat: boolean,
): Decimal {
  if (fertilizerDetail.p_type_rvo && SEWAGE_SLUDGE_TYPES_RVO.has(fertilizerDetail.p_type_rvo)) {
    return new Decimal(EF_N2O_SEWAGE_SLUDGE)
  }

  const soil = isPeat ? "peat" : "mineral"
  if (fertilizerDetail.p_type === "mineral" || fertilizerDetail.p_type === "manure") {
    const landType = determineLandTypeAtDate(
      application.p_app_date,
      cultivations,
      cultivationDetailsMap,
    )
    const landUse = landType === "grassland" ? "grassland" : "cropland"

    if (fertilizerDetail.p_type === "mineral") {
      return new Decimal(EF_N2O_MINERAL[landUse][soil])
    }

    // Manure: the application method is required, as in the ammonia emission
    if (!application.p_app_method) {
      throw new Error(
        `Unsupported application method ${application.p_app_method} for ${application.p_name_nl} (${application.p_id})`,
      )
    }
    const method = SURFACE_APPLICATION_METHODS.has(application.p_app_method)
      ? "surface"
      : "lowEmission"
    return new Decimal(EF_N2O_MANURE[method][landUse][soil])
  }

  return new Decimal(EF_N2O_OTHER_ORGANIC)
}

/**
 * Calculates the N₂O emission from the mineralisation of organic soils (kg N₂O-N / ha, positive).
 *
 * Peat (`veen`) and peaty soils (`moerige_klei`) have a yearly emission (NEMA WOT-283, section 3.4).
 * The yearly value is scaled to the length of the time frame, in the same way as the nitrogen
 * deposition: (number of days + 1) / 365. Other soils have no emission from mineralisation.
 *
 * @param b_soiltype_agr - The agricultural soil type of the field.
 * @param timeFrame - The time frame of the calculation for this field.
 * @returns The N₂O-N emission over the time frame, zero or positive.
 *
 * @example
 * ```ts
 * calculateNitrousOxideEmissionOrganicSoil("veen", { start: new Date("2025-01-01"), end: new Date("2025-12-31") })
 * // Decimal(4.67)
 * ```
 */
export function calculateNitrousOxideEmissionOrganicSoil(
  b_soiltype_agr: SoilAnalysisPicked["b_soiltype_agr"],
  timeFrame: { start: Date; end: Date },
): Decimal {
  const yearlyEmission = b_soiltype_agr ? YEARLY_N2O_ORGANIC_SOILS[b_soiltype_agr] : undefined
  if (yearlyEmission === undefined) {
    return new Decimal(0)
  }
  const days = differenceInCalendarDays(timeFrame.end, timeFrame.start)
  if (days < 0) {
    return new Decimal(0)
  }
  return new Decimal(yearlyEmission).times(days + 1).dividedBy(365)
}

/**
 * Converts an N₂O emission (kg N₂O-N / ha) to the CO₂-equivalent (kg CO₂-eq / ha), using the
 * molar mass ratio of N₂O to N₂O-N (44 / 28) and a global warming potential of 265 (IPCC AR5).
 *
 * @param nitrousOxide - The N₂O emission in kg N₂O-N / ha; the sign is ignored.
 * @returns The CO₂-equivalent in kg CO₂-eq / ha, zero or positive.
 *
 * @example
 * ```ts
 * convertNitrousOxideToCo2Equivalent(new Decimal(-1))
 * // Decimal(416.43)
 * ```
 */
export function convertNitrousOxideToCo2Equivalent(nitrousOxide: Decimal): Decimal {
  return nitrousOxide.abs().times(N2O_N_TO_N2O).times(GWP_N2O)
}

/**
 * Creates an N₂O emission with all values set to zero, e.g. for buffer strips.
 *
 * @returns An N₂O emission with all values set to zero.
 */
export function createEmptyNitrousOxideEmission(): NitrogenEmissionNitrousOxide {
  const emptyGroup = () => ({
    total: new Decimal(0),
    applications: [] as { id: string; value: Decimal }[],
  })
  return {
    total: new Decimal(0),
    fertilizers: {
      total: new Decimal(0),
      mineral: emptyGroup(),
      manure: emptyGroup(),
      compost: emptyGroup(),
      other: emptyGroup(),
    },
    residues: { total: new Decimal(0), cultivations: [] },
    soil: { total: new Decimal(0) },
    indirect: {
      total: new Decimal(0),
      volatilisation: new Decimal(0),
      leaching: new Decimal(0),
    },
    co2eq: new Decimal(0),
  }
}

/**
 * Calculates the area-weighted average N₂O emission of a farm from the N₂O emission of its fields.
 *
 * Fields without an N₂O emission are counted as zero emission.
 *
 * @param fields - The area (ha) and the N₂O emission of each field.
 * @returns The average N₂O emission per hectare of the farm (kg N₂O-N / ha) and the average
 * CO₂-equivalent of the fields (kg CO₂-eq / ha).
 *
 * @example
 * ```ts
 * const farmEmission = calculateNitrousOxideEmissionFarm([
 *   { b_area: 10, nitrousOxide: fieldA.emission.nitrous_oxide },
 *   { b_area: 5, nitrousOxide: fieldB.emission.nitrous_oxide },
 * ])
 * ```
 */
export function calculateNitrousOxideEmissionFarm(
  fields: {
    b_area: number | null | undefined
    nitrousOxide?: NitrogenEmissionNitrousOxideNumeric
  }[],
): NitrogenEmissionNitrousOxideFarm {
  let totalArea = new Decimal(0)
  const sum = {
    total: new Decimal(0),
    fertilizers: {
      total: new Decimal(0),
      mineral: new Decimal(0),
      manure: new Decimal(0),
      compost: new Decimal(0),
      other: new Decimal(0),
    },
    residues: new Decimal(0),
    soil: new Decimal(0),
    indirect: {
      total: new Decimal(0),
      volatilisation: new Decimal(0),
      leaching: new Decimal(0),
    },
    co2eq: new Decimal(0),
  }

  for (const field of fields) {
    const area = new Decimal(field.b_area ?? 0)
    totalArea = totalArea.add(area)
    const n2o = field.nitrousOxide
    if (!n2o) continue
    sum.total = sum.total.add(area.times(n2o.total))
    sum.fertilizers.total = sum.fertilizers.total.add(area.times(n2o.fertilizers.total))
    for (const type of fertilizerTypes) {
      sum.fertilizers[type] = sum.fertilizers[type].add(area.times(n2o.fertilizers[type].total))
    }
    sum.residues = sum.residues.add(area.times(n2o.residues.total))
    sum.soil = sum.soil.add(area.times(n2o.soil.total))
    sum.indirect.total = sum.indirect.total.add(area.times(n2o.indirect.total))
    sum.indirect.volatilisation = sum.indirect.volatilisation.add(
      area.times(n2o.indirect.volatilisation),
    )
    sum.indirect.leaching = sum.indirect.leaching.add(area.times(n2o.indirect.leaching))
    sum.co2eq = sum.co2eq.add(area.times(n2o.co2eq))
  }

  const average = (value: Decimal) =>
    totalArea.isZero() ? new Decimal(0) : value.dividedBy(totalArea)
  return {
    total: average(sum.total),
    fertilizers: {
      total: average(sum.fertilizers.total),
      mineral: average(sum.fertilizers.mineral),
      manure: average(sum.fertilizers.manure),
      compost: average(sum.fertilizers.compost),
      other: average(sum.fertilizers.other),
    },
    residues: average(sum.residues),
    soil: average(sum.soil),
    indirect: {
      total: average(sum.indirect.total),
      volatilisation: average(sum.indirect.volatilisation),
      leaching: average(sum.indirect.leaching),
    },
    // Average of the CO₂-equivalents of the fields, so that small field emissions still count
    co2eq: average(sum.co2eq),
  }
}

/**
 * Returns a positive amount as a (negative) emission, without returning a negative zero.
 */
function toEmission(value: Decimal): Decimal {
  return value.isZero() ? new Decimal(0) : value.abs().neg()
}
