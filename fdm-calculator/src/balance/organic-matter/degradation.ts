import { addDays, differenceInDays } from "date-fns"
import Decimal from "decimal.js"
import type {
  CultivationDetail,
  FieldInput,
  OrganicMatterDegradation,
  SoilAnalysisPicked,
} from "./types"

/**
 * Calculates the total degradation of soil organic matter (SOM) for a given period.
 *
 * The calculation is based on a formula that considers soil properties, land use (grassland vs. arable),
 * and environmental factors like temperature. The degradation is calculated as an annual rate and then
 * multiplied by the number of years in the specified timeframe.
 *
 * The formula used is derived from scientific models that estimate SOM turnover. It includes:
 * - Soil Organic Matter content (`a_som_loi`)
 * - Bulk density (`a_density_sa`)
 * - Soil depth (`b_depth`), which varies for grassland and arable land.
 * - A temperature correction factor to account for the influence of temperature on microbial activity.
 *
 * The annual degradation is capped at a maximum of 3500 kg OM/ha/year.
 *
 * @param soilAnalysis - The soil analysis data for the field, containing SOM content and bulk density.
 * @param cultivations - The list of cultivations on the field to determine land use (grassland or arable).
 * @param cultivationDetailsMap - A map to look up cultivation details, such as crop rotation type.
 * @param timeFrame - The start and end date for the calculation period.
 * @returns An object containing the total organic matter degradation in kg OM/ha for the period.
 *
 */
export function calculateOrganicMatterDegradation(
  soilAnalysis: SoilAnalysisPicked,
  cultivations: FieldInput["cultivations"],
  cultivationDetailsMap: Map<string, CultivationDetail>,
  timeFrame: { start: Date; end: Date },
): OrganicMatterDegradation {
  if (soilAnalysis.a_som_loi == null || soilAnalysis.a_density_sa == null) {
    return { total: new Decimal(0) }
  }

  // Determine if the land use is grassland based on the crop rotation type of the cultivations.
  const isGrassland = cultivations.some((c: { b_lu_catalogue: string }) => {
    const b_lu_catalogue = c.b_lu_catalogue
    const b_lu_croprotation = cultivationDetailsMap.get(b_lu_catalogue)?.b_lu_croprotation
    return b_lu_croprotation === "grass"
  })

  // Set the active soil depth based on land use: 10 cm for grassland, 30 cm for arable land.
  const b_depth = isGrassland ? new Decimal(10) : new Decimal(30)

  // Average yearly temperature for the region (e.g., Netherlands/Belgium). This could be made more dynamic.
  const averageYearlyTemperature = new Decimal(9.3) // degrees Celsius
  // Calculate a temperature correction factor based on the average temperature.
  // This factor adjusts the degradation rate based on how temperature affects microbial activity.
  const temperatureCorrection = new Decimal(2).pow(averageYearlyTemperature.minus(13).dividedBy(10))

  if (soilAnalysis.a_som_loi == null || soilAnalysis.a_density_sa == null) {
    throw new Error(`"Soil analysis data (SOM or bulk density) is missing."`)
  }

  // Extract soil properties from the analysis.
  const a_som_loi = new Decimal(soilAnalysis.a_som_loi) // Soil Organic Matter content (%)
  const a_density_sa = new Decimal(soilAnalysis.a_density_sa).times(1000) // Bulk density (g/cm³)

  // Guard against non-positive SOM value
  if (a_som_loi.lte(0)) {
    return { total: new Decimal(0) }
  }

  // Calculate the annual degradation rate using an empirical formula.
  // The formula combines soil properties and the temperature correction factor.
  let annualDegradation = a_som_loi
    .times(b_depth)
    .times(a_density_sa)
    .times(a_som_loi.ln().times(-0.008934).add(0.038228))
    .times(temperatureCorrection)

  // The degradation cannot be negative.
  if (annualDegradation.lessThan(0)) {
    annualDegradation = new Decimal(0)
  } else if (annualDegradation.greaterThan(3500)) {
    // Apply a cap to the annual degradation rate to prevent unrealistic values.
    annualDegradation = new Decimal(3500) // kg OM/ha/year
  }

  // Calculate the total degradation over the given timeframe.
  // The number of years is calculated between the start and end of the timeframe.
  const numberOfYears = new Decimal(
    differenceInDays(addDays(timeFrame.end, 1), timeFrame.start),
  ).dividedBy(365)
  const totalDegradation = annualDegradation.times(numberOfYears)

  return {
    total: totalDegradation.times(-1),
  }
}
