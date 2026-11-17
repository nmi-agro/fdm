import type { fdmSchema } from "@nmi-agro/fdm-core"
import { differenceInCalendarDays } from "date-fns"
import Decimal from "decimal.js"
import type {
  CultivationDetail,
  FieldInput,
  NitrogenBalanceInput,
  NitrogenSupplyMineralization,
  SoilAnalysisPicked,
} from "../types"
import { calculateMinipNitrogenMineralization } from "../../../shared/minip"

/**
 * Calculates the amount of nitrogen supplied through soil mineralization.
 *
 * By default, a default value per soil type and land use is used. With `useMinip`, the yearly
 * mineralization is calculated with the MINIP model from the soil analysis (organic carbon,
 * C/N ratio and bulk density). In both cases the yearly value is pro-rated for the timeframe.
 * @param cultivations - The cultivations on the field.
 * @param soilAnalysis - Combined soil analysis data for the field.
 * @param cultivationDetails - A map with the details of each cultivation.
 * @param timeFrame - The timeframe for which to calculate the nitrogen mineralization.
 * @param useMinip - When `true`, the MINIP model is used instead of the default values. Defaults to `false`.
 * @returns The NitrogenSupplyMineralization object containing the total amount of Nitrogen mineralized.
 * @throws Throws an error when `useMinip` is `true` and `a_c_of`, `a_cn_fr` or `a_density_sa` is missing.
 */
export function calculateNitrogenSupplyBySoilMineralization(
  cultivations: FieldInput["cultivations"],
  soilAnalysis: SoilAnalysisPicked,
  cultivationDetails: Map<string, CultivationDetail>,
  timeFrame: NitrogenBalanceInput["timeFrame"],
  useMinip = false,
): NitrogenSupplyMineralization {
  let totalMineralization = new Decimal(0)
  const minerlizationPerYear = []

  // MINIP gives the yearly mineralization (kg N / ha / year) from the soil analysis. It is only
  // calculated for a year that overlaps with the timeframe, so that its soil parameters are not
  // required when the timeframe is empty.
  let yearlyMineralizationMinip: Decimal | undefined

  const startYear = timeFrame.start.getFullYear()
  const endYear = timeFrame.end.getFullYear()

  for (let year = startYear; year <= endYear; year++) {
    const may15 = new Date(year, 4, 15)
    const july15 = new Date(year, 6, 15)

    const isGrassland = cultivations.some((cultivation) => {
      const cultivationDetail = cultivationDetails.get(cultivation.b_lu_catalogue)
      if (!cultivationDetail) return false

      const cultivationStart = cultivation.b_lu_start
        ? new Date(cultivation.b_lu_start)
        : new Date(0) // Default to epoch if null
      const cultivationEnd = cultivation.b_lu_end
        ? new Date(cultivation.b_lu_end)
        : new Date("9999-12-31")

      // Check if the cultivation is grassland and overlaps with the May 15th to July 15th window
      return (
        cultivationDetail.b_lu_croprotation === "grass" &&
        cultivationStart <= july15 &&
        cultivationEnd >= may15
      )
    })

    const yearStartTime = new Date(year, 0, 1).getTime()
    const yearEndTime = new Date(year + 1, 0, 1).getTime()
    const timeframeStartTime = timeFrame.start.getTime()
    const timeframeEndTime = timeFrame.end.getTime()

    const overlapStart = Math.max(yearStartTime, timeframeStartTime)
    const overlapEnd = Math.min(yearEndTime, timeframeEndTime)

    if (overlapStart < overlapEnd) {
      if (useMinip && yearlyMineralizationMinip === undefined) {
        yearlyMineralizationMinip = calculateNitrogenSupplyBySoilMineralizationUsingMinip(
          soilAnalysis.a_c_of,
          soilAnalysis.a_cn_fr,
          soilAnalysis.a_density_sa,
        )
      }
      const yearlyMineralization =
        yearlyMineralizationMinip ??
        calculateNitrogenSupplyBySoilMineralizationUsingDefaults(
          soilAnalysis.b_soiltype_agr,
          isGrassland,
        )
      const daysInYear = new Date(year, 1, 29).getMonth() === 1 ? 366 : 365
      const overlapDays = differenceInCalendarDays(new Date(overlapEnd), new Date(overlapStart))
      const adjustedMineralization = yearlyMineralization.times(overlapDays).dividedBy(daysInYear)
      totalMineralization = totalMineralization.add(adjustedMineralization)
      minerlizationPerYear.push({
        year,
        value: adjustedMineralization,
      })
    }
  }

  return {
    total: totalMineralization,
    years: minerlizationPerYear,
  }
}

/**
 * Calculates the default nitrogen supply by soil mineralization based on soil type and land use.
 *
 * @param b_soiltype_agr - The agricultural soil type from the soil analysis.
 * @param is_grassland - A boolean indicating if the land is grassland.
 * @returns The default mineralization value in kg N / ha / year as a Decimal.
 */
function calculateNitrogenSupplyBySoilMineralizationUsingDefaults(
  b_soiltype_agr: SoilAnalysisPicked["b_soiltype_agr"],
  is_grassland: boolean,
): Decimal {
  let mineralization = new Decimal(0)

  // At Dalgrond set mineralization to 20 kg N / ha / year
  if (b_soiltype_agr === "dalgrond") {
    mineralization = new Decimal(20)
  }

  // At Veen, set default mineralization based on land use
  if (b_soiltype_agr === "veen") {
    if (is_grassland) {
      mineralization = new Decimal(160)
    } else {
      // Arable or fallow
      mineralization = new Decimal(20)
    }
  }

  return mineralization
}

/**
 * Calculates the amount of nitrogen supplied through soil mineralization by using the MINIP model
 *
 * The organic carbon stock of the plough layer (20 cm) is derived from the organic carbon content and
 * the soil bulk density. The mineralization is calculated over 10 years at the average yearly
 * temperature in the Netherlands (10.6 °C) and returned as the yearly average.
 * @param a_c_of - The organic carbon content of the soil (g C / kg soil).
 * @param a_cn_fr - The C/N ratio of the soil organic matter.
 * @param a_density_sa - The soil bulk density (g / cm³).
 * @returns The amount of nitrogen mineralized in kg N / ha / year.
 * @throws Throws an error if required soil analysis data is missing.
 */
export function calculateNitrogenSupplyBySoilMineralizationUsingMinip(
  a_c_of: fdmSchema.soilAnalysisTypeSelect["a_c_of"],
  a_cn_fr: fdmSchema.soilAnalysisTypeSelect["a_cn_fr"],
  a_density_sa: fdmSchema.soilAnalysisTypeSelect["a_density_sa"],
): Decimal {
  if (a_c_of === null || a_c_of === undefined) {
    throw new Error("No a_c_of value found in soil analysis for arable")
  }
  if (a_cn_fr === null || a_cn_fr === undefined) {
    throw new Error("No a_cn_fr value found in soil analysis for arable")
  }
  if (a_density_sa === null || a_density_sa === undefined) {
    throw new Error("No a_density_sa value found in soil analysis for arable")
  }

  // Depth of the plough layer (m) and length of the period (years)
  const depth = new Decimal(0.2)
  const years = new Decimal(10)

  // Organic carbon stock of the plough layer (kg C / ha): g C / kg soil * t soil / ha
  const c_stock = new Decimal(a_c_of).times(a_density_sa).times(depth).times(10000)

  const mineralization = calculateMinipNitrogenMineralization({
    c_stock,
    a_cn_fr,
    age: 17,
    temperature: 10.6,
    time: years,
  })

  return mineralization.dividedBy(years)
}
