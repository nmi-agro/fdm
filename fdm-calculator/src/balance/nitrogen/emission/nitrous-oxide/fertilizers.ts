/* eslint-disable typescript/restrict-template-expressions -- Values in error messages are formatted inside template strings on purpose. */
import type { BaseFertilizerApplication } from "@nmi-agro/fdm-core"
import Decimal from "decimal.js"
import type {
  CultivationDetail,
  FertilizerDetail,
  FieldInput,
  NitrogenEmissionNitrousOxideFertilizers,
  SoilAnalysisPicked,
} from "../../types"
import { determineCropRotationGroupAtDate } from "../crop-rotation-group"
import {
  EF_N2O_MANURE,
  EF_N2O_MINERAL,
  EF_N2O_OTHER_ORGANIC,
  EF_N2O_SEWAGE_SLUDGE,
  SEWAGE_SLUDGE_TYPES_RVO,
  SURFACE_APPLICATION_METHODS,
} from "./constants"
import { toEmission } from "./conversion"

const fertilizerTypes = ["mineral", "manure", "compost", "other"] as const

/**
 * Calculates the direct nitrous oxide (N₂O) emission from fertilizer applications.
 *
 * The emission of an application is the total nitrogen applied times an emission factor (see
 * {@link determineNitrousOxideEmissionFactor}). Applications of fertilizers without a known type,
 * such as sewage sludge, are counted as `other`.
 *
 * @param cultivations - The cultivations of the field, used to determine the crop rotation group.
 * @param fertilizerApplications - The fertilizer applications on the field.
 * @param cultivationDetailsMap - A map of cultivation details, with the cultivation catalogue identifier as key.
 * @param fertilizerDetailsMap - A map of fertilizer details, with the fertilizer catalogue identifier as key.
 * @param soilAnalysis - The soil parameters of the field; `b_soiltype_agr` is used.
 * @returns The N₂O emission by type of fertilizer and per application (kg N / ha, as N₂O-N, negative).
 * @throws {Error} If a fertilizer application has no fertilizer details, or if a manure application
 * has no application method.
 *
 * @example
 * ```ts
 * const fertilizers = calculateNitrogenEmissionViaNitrousOxideByFertilizers(
 *   cultivations,
 *   fertilizerApplications,
 *   cultivationDetailsMap,
 *   fertilizerDetailsMap,
 *   { b_soiltype_agr: "dekzand" },
 * )
 * // fertilizers.total: Decimal(-2.299)
 * ```
 */
export function calculateNitrogenEmissionViaNitrousOxideByFertilizers(
  cultivations: FieldInput["cultivations"],
  fertilizerApplications: FieldInput["fertilizerApplications"],
  cultivationDetailsMap: Map<string, CultivationDetail>,
  fertilizerDetailsMap: Map<string, FertilizerDetail>,
  soilAnalysis: Pick<SoilAnalysisPicked, "b_soiltype_agr">,
): NitrogenEmissionNitrousOxideFertilizers {
  const isPeat = soilAnalysis.b_soiltype_agr === "veen"
  const fertilizers = createEmptyNitrousOxideEmissionFertilizers()

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
    fertilizers[fertilizerType].total = fertilizers[fertilizerType].total.add(value)
    fertilizers[fertilizerType].applications.push({ id: application.p_app_id, value })
    fertilizers.total = fertilizers.total.add(value)
  }

  return fertilizers
}

/**
 * Determines the N₂O emission factor of a fertilizer application (kg N as N₂O-N per kg N applied),
 * according to NEMA WOT-283 (tables 2.7, 3.2 and 3.3).
 *
 * - Sewage sludge (`p_type_rvo` 113 or 114): 0.009.
 * - Manure: depends on the application method (surface spreading or low-emission application), the
 *   crop rotation group at the date of application and whether the soil is peat.
 * - Mineral fertilizer: depends on the crop rotation group at the date of application and whether
 *   the soil is peat.
 * - Compost and other fertilizers: 0.004.
 *
 * The crop rotation group is grassland or cropland; bare soil is treated as cropland. Nature
 * grassland counts as grassland.
 *
 * @param application - The fertilizer application.
 * @param fertilizerDetail - The details of the applied fertilizer.
 * @param cultivations - The cultivations of the field, used to determine the crop rotation group.
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
    // NEMA distinguishes grassland and cropland; bare soil is treated as cropland
    const cropRotationGroup =
      determineCropRotationGroupAtDate(
        application.p_app_date,
        cultivations,
        cultivationDetailsMap,
      ) === "grassland"
        ? "grassland"
        : "cropland"

    if (fertilizerDetail.p_type === "mineral") {
      return new Decimal(EF_N2O_MINERAL[cropRotationGroup][soil])
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
    return new Decimal(EF_N2O_MANURE[method][cropRotationGroup][soil])
  }

  return new Decimal(EF_N2O_OTHER_ORGANIC)
}

/**
 * Creates an N₂O emission from fertilizers with all values set to zero.
 *
 * @returns An N₂O emission from fertilizers with all values set to zero.
 */
export function createEmptyNitrousOxideEmissionFertilizers(): NitrogenEmissionNitrousOxideFertilizers {
  const emptyGroup = () => ({
    total: new Decimal(0),
    applications: [] as { id: string; value: Decimal }[],
  })
  return {
    total: new Decimal(0),
    mineral: emptyGroup(),
    manure: emptyGroup(),
    compost: emptyGroup(),
    other: emptyGroup(),
  }
}
