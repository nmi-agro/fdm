import Decimal from "decimal.js"
import type {
  CultivationDetail,
  FieldInput,
  NitrogenEmissionNitrate,
  SoilAnalysisPicked,
} from "../../types"

/**
 * Calculates the nitrogen emission via nitrate leaching.
 *
 * This function determines the land type based on the active cultivations and then calculates the nitrate emission
 * by multiplying the nitrogen balance by a nitrate leaching factor. The factor is determined based on land type,
 * soil type, and groundwater level class.
 *
 * @param balance - The nitrogen balance (surplus or deficit) for the field.
 * @param cultivations - An array of cultivation objects for the field.
 * @param soilAnalysis - A picked subset of soil analysis data for the field.
 * @param cultivationDetails - A map of cultivation details, with cultivation IDs as keys.
 * @returns An object containing the total nitrate emission.
 *
 * @example
 * ```
 * const balance = new Decimal(100);
 * const cultivations = [{ b_lu_catalogue: 'grass' }];
 * const soilAnalysis = { b_soiltype_agr: 'dekzand', b_gwl_class: 'V' };
 * const cultivationDetails = new Map([['grass', { b_lu_croprotation: 'grass' }]]);
 * const result = calculateNitrogenEmissionViaNitrate(balance, cultivations, soilAnalysis, cultivationDetails);
 * console.log(result); // { total: '16' }
 * ```
 */
export function calculateNitrogenEmissionViaNitrate(
  balance: Decimal,
  cultivations: FieldInput["cultivations"],
  soilAnalysis: SoilAnalysisPicked,
  cultivationDetails: Map<string, CultivationDetail>,
): NitrogenEmissionNitrate {
  // Determine land type based on active cultivations, prioritizing cropland
  let landType: "grassland" | "cropland" | "bare soil"
  let hasGrassland = false
  let hasCropland = false

  // Define sets for different crop rotation types for efficient lookup
  const grasslandRotations = new Set(["grass", "clover"])
  const croplandRotations = new Set([
    "potato",
    "rapeseed",
    "starch",
    "maize",
    "cereal",
    "sugarbeet",
    "catchcrop",
    "alfalfa",
    "nature",
    "other",
  ])
  // Define a set of crop codes that should be considered as bare soil, even if they fall into other categories
  const bareSoilCropCodes = new Set([
    "nl_6794", // Braak, zwart
    "nl_662", // Grasland, blijvend, natuurlijk, hoofdfunctie natuur
    "nl_6798", // Grasland, tijdelijk, hoofdfunctie natuur
    "nl_2300", // Groenbemester
    "nl_3802", // Groenbemester / rustgewas (geen N-bemesting)
    "nl_3801", // Groenbemester / rustgewas (wel N-bemesting)
  ])

  // Iterate over cultivations to determine the presence of grassland and cropland
  for (const cultivation of cultivations) {
    const rotation = cultivationDetails.get(cultivation.b_lu_catalogue)?.b_lu_croprotation

    // Check for grassland, excluding bare soil types
    if (
      rotation &&
      grasslandRotations.has(rotation) &&
      !bareSoilCropCodes.has(cultivation.b_lu_catalogue)
    ) {
      hasGrassland = true
    }

    // Check for cropland, excluding bare soil types
    if (
      rotation &&
      croplandRotations.has(rotation) &&
      !bareSoilCropCodes.has(cultivation.b_lu_catalogue)
    ) {
      hasCropland = true
    }
  }

  // Set land type based on the presence of different cultivation types
  if (hasGrassland) {
    landType = "grassland"
  } else if (hasCropland) {
    landType = "cropland"
  } else {
    landType = "bare soil"
  }

  const b_soiltype_agr = soilAnalysis.b_soiltype_agr
  const b_gwl_class = soilAnalysis.b_gwl_class

  // Determine the Nitrate Leaching Factor based on land type, soil type, and groundwater level
  const nitrateLeachingFactor = determineNitrateLeachingFactor(
    landType,
    b_soiltype_agr,
    b_gwl_class,
  )

  // Calculate nitrate emission as the Nitrogen surplus times the Nitrate Leaching Factor
  // Emission only occurs if there is a surplus (balance > 0)
  let nitrateEmission = new Decimal(0)
  if (balance.gt(0)) {
    nitrateEmission = balance.times(nitrateLeachingFactor).times(-1)
  }

  const nitrate = {
    total: nitrateEmission,
  }

  return nitrate
}

/**
 * Determines the nitrate leaching factor based on land use, soil type, and groundwater level.
 *
 * The leaching factor is a coefficient that represents the fraction of the nitrogen surplus that leaches into the groundwater as nitrate.
 * This factor varies depending on the agricultural use of the land (grassland vs. cropland), the type of soil, and the groundwater level class (GWL).
 *
 * @param landType - The type of land use ('grassland', 'cropland', or 'bare soil').
 * @param b_soiltype_agr - The agricultural soil type.
 * @param b_gwl_class - The groundwater level class.
 * @returns The nitrate leaching factor as a Decimal.
 * @throws {Error} If the soil type or GWL class is unknown.
 *
 * @example
 * ```
 * const factor = determineNitrateLeachingFactor('grassland', 'dekzand', 'V');
 * console.log(factor.toString()); // '0.16'
 * ```
 */
export function determineNitrateLeachingFactor(
  landType: "grassland" | "cropland" | "bare soil",
  b_soiltype_agr: SoilAnalysisPicked["b_soiltype_agr"],
  b_gwl_class: SoilAnalysisPicked["b_gwl_class"],
): Decimal {
  // Validate landType parameter
  if (!["grassland", "cropland", "bare soil"].includes(landType)) {
    throw new Error(`Unknown land type: ${landType}`)
  }

  if (typeof b_soiltype_agr !== "string") {
    throw new Error(`Invalid or missing soil type: ${b_soiltype_agr}`)
  }

  let nitrateLeachingFactor = 0

  // Group the soil types for easier processing
  const peatSoils = ["veen"]
  const claySoils = ["moerige_klei", "rivierklei", "zeeklei", "maasklei"]
  const loessSoils = ["loess"]
  const sandySoils = ["dekzand", "dalgrond", "duinzand"]

  // Determine the leaching factor based on soil type and land use
  if (peatSoils.includes(b_soiltype_agr)) {
    nitrateLeachingFactor = landType === "grassland" ? 0.06 : 0.17
  } else if (claySoils.includes(b_soiltype_agr)) {
    nitrateLeachingFactor = landType === "grassland" ? 0.11 : 0.33
  } else if (loessSoils.includes(b_soiltype_agr)) {
    nitrateLeachingFactor = landType === "grassland" ? 0.14 : 0.74
  } else if (sandySoils.includes(b_soiltype_agr)) {
    if (typeof b_gwl_class !== "string") {
      throw new Error(
        `Invalid or missing GWL class '${b_gwl_class}' for sandy soil '${b_soiltype_agr}'`,
      )
    }

    // For sandy soils, the factor also depends on the groundwater level class (GWL)
    if (["I", "Ia", "Ic", "II", "IIa", "IIb", "IIc"].includes(b_gwl_class)) {
      nitrateLeachingFactor = landType === "grassland" ? 0.02 : 0.04
    } else if (["III", "IIIa"].includes(b_gwl_class)) {
      nitrateLeachingFactor = landType === "grassland" ? 0.03 : 0.07
    } else if (["IIIb"].includes(b_gwl_class)) {
      nitrateLeachingFactor = landType === "grassland" ? 0.1 : 0.28
    } else if (["IV", "IVu", "IVc"].includes(b_gwl_class)) {
      nitrateLeachingFactor = landType === "grassland" ? 0.14 : 0.38
    } else if (["V", "Va", "Vao", "Vad", "Vb", "Vbo", "Vbd", "sV", "sVb"].includes(b_gwl_class)) {
      nitrateLeachingFactor = landType === "grassland" ? 0.16 : 0.44
    } else if (["VI", "VIo", "VId"].includes(b_gwl_class)) {
      nitrateLeachingFactor = landType === "grassland" ? 0.21 : 0.58
    } else if (["VII", "VIIo", "VIId"].includes(b_gwl_class)) {
      nitrateLeachingFactor = landType === "grassland" ? 0.27 : 0.74
    } else if (["VIII", "VIIIo", "VIIId"].includes(b_gwl_class)) {
      nitrateLeachingFactor = landType === "grassland" ? 0.32 : 0.89
    } else {
      // Throw an error if the GWL class is not recognized for sandy soils
      throw new Error(`Unknown GWL class '${b_gwl_class}' for sandy soil '${b_soiltype_agr}'`)
    }
  } else {
    // Throw an error if the soil type is not recognized
    throw new Error(`Unknown soil type: ${b_soiltype_agr}`)
  }

  return new Decimal(nitrateLeachingFactor)
}
