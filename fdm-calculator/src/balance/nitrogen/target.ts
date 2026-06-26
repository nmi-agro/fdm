import { differenceInCalendarDays } from "date-fns"
import Decimal from "decimal.js"
import type {
  CultivationDetail,
  FieldInput,
  NitrogenBalanceInput,
  SoilAnalysisPicked,
} from "./types"

/**
 * Calculates the target nitrogen balance based on cultivation type, soil analysis, and cultivation details.
 *
 * This function determines the target nitrogen balance for a field based on several factors:
 * - **Cultivation Type**: Distinguishes between grassland and arable land.
 * - **Soil Analysis**: Considers soil type (sand/loess or clay/peat) and groundwater class.
 * - **Cultivation Details**: Uses a map of cultivation details to identify crop rotation types.
 * - **Time Frame**: Adjusts the target value based on the length of the specified time period.
 *
 * The function uses a predefined set of target values based on combinations of these factors,
 * derived from Ros et al. 2023.
 * @returns A Decimal representing the calculated target nitrogen balance in kg N / ha, adjusted for the given time frame.
 */
export function calculateTargetForNitrogenBalance(
  cultivations: FieldInput["cultivations"],
  soilAnalysis: SoilAnalysisPicked,
  cultivationDetailsMap: Map<string, CultivationDetail>,
  timeFrame: NitrogenBalanceInput["timeFrame"],
): Decimal {
  // Determine whether field is grassland or arable
  let cultivationType = "arable"
  cultivations.forEach((cultivation) => {
    const cultivationDetail = cultivationDetailsMap.get(cultivation.b_lu_catalogue)

    if (cultivationDetail?.b_lu_croprotation === "grass") {
      cultivationType = "grassland"
    }
  })

  // Determine whether field is zand/loess or klei/veen
  let soilType: string
  if (
    ["moerige_klei", "rivierklei", "zeeklei", "maasklei", "veen"].includes(
      soilAnalysis.b_soiltype_agr ?? "",
    )
  ) {
    soilType = "clay"
  } else if (
    ["dekzand", "dalgrond", "duinzand", "loess"].includes(soilAnalysis.b_soiltype_agr ?? "")
  ) {
    soilType = "sand"
  } else {
    throw new Error("Unknown soil type")
  }

  // Determine groundwaterclass
  let groundwaterClass: string
  if (["VII", "VIIo", "VIId", "VIII", "VIIIo", "VIIId"].includes(soilAnalysis.b_gwl_class ?? "")) {
    groundwaterClass = "dry"
  } else if (
    ["V", "Va", "Vao", "Vad", "Vb", "Vbo", "Vbd", "sV", "sVb", "VI", "VIo", "VId"].includes(
      soilAnalysis.b_gwl_class ?? "",
    )
  ) {
    groundwaterClass = "average"
  } else if (
    [
      "I",
      "Ia",
      "Ic",
      "II",
      "IIa",
      "IIb",
      "IIc",
      "III",
      "IIIa",
      "IIIb",
      "IV",
      "IVu",
      "IVc",
    ].includes(soilAnalysis.b_gwl_class ?? "")
  ) {
    groundwaterClass = "wet"
  } else {
    throw new Error("Unknown groundwater class")
  }

  // Determine targetValue based on Ros et al. 2023
  let targetValue: Decimal = new Decimal(0)
  if (cultivationType === "grassland" && soilType === "sand" && groundwaterClass === "dry") {
    targetValue = new Decimal(80)
  } else if (cultivationType === "grassland") {
    targetValue = new Decimal(125)
  } else if (cultivationType === "arable" && soilType === "sand" && groundwaterClass === "dry") {
    targetValue = new Decimal(50)
  } else if (
    cultivationType === "arable" &&
    soilType === "sand" &&
    groundwaterClass === "average"
  ) {
    targetValue = new Decimal(70)
  } else if (cultivationType === "arable" && soilType === "sand" && groundwaterClass === "wet") {
    targetValue = new Decimal(125)
  } else if (cultivationType === "arable" && soilType === "clay" && groundwaterClass === "dry") {
    targetValue = new Decimal(115)
  } else if (cultivationType === "arable" && soilType === "clay") {
    targetValue = new Decimal(125)
  } else {
    throw new Error("Unknown combination of classes")
  }

  // Adjust for the number of days
  const timeFrameDays = new Decimal(differenceInCalendarDays(timeFrame.end, timeFrame.start))
  // Ensure timeFrameDays is positive
  if (timeFrameDays.lessThanOrEqualTo(0)) {
    return new Decimal(0)
  }
  const timeFrameFraction = timeFrameDays.add(1).dividedBy(365)
  const target = targetValue.times(timeFrameFraction)

  return target
}
