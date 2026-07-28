import { calculateNlv } from "@nmi-agro/fdm-calculator"
import type { CurrentSoilData } from "@nmi-agro/fdm-core"

/**
 * Enriches current soil data with the calculated base Nitrogen Supplying Capacity (d_n_supply_base / NLV)
 * if it is not already present and if soil organic matter (a_som_loi) is available.
 *
 * Sets the source to "calculated" ("Berekend").
 *
 * @param currentSoilData The current soil parameter measurements for a field.
 * @returns The enriched CurrentSoilData array.
 */
export function enrichCurrentSoilDataWithNlv(
  currentSoilData: CurrentSoilData,
): CurrentSoilData {
  const data = currentSoilData.filter(
    (item) => item.parameter !== "d_n_supply_base" || item.value != null,
  )
  const hasNlv = data.some(
    (item) => item.parameter === "d_n_supply_base" && item.value != null,
  )
  if (!hasNlv) {
    const somItem = data.find((item) => item.parameter === "a_som_loi")
    const clayItem = data.find((item) => item.parameter === "a_clay_mi")
    const cnItem = data.find((item) => item.parameter === "a_cn_fr")
    if (
      somItem &&
      typeof somItem.value === "number" &&
      clayItem &&
      typeof clayItem.value === "number" &&
      cnItem &&
      typeof cnItem.value === "number"
    ) {
      const nlvVal =
        Math.round(
          calculateNlv({
            a_clay_mi: clayItem.value,
            a_cn_fr: cnItem.value,
            a_som_loi: somItem.value,
          }) * 10,
        ) / 10
      data.push({
        parameter: "d_n_supply_base",
        value: nlvVal,
        a_id: somItem.a_id,
        b_sampling_date: somItem.b_sampling_date,
        a_depth_upper: somItem.a_depth_upper,
        a_depth_lower: somItem.a_depth_lower,
        a_source: "calculated",
      })
    }
  }
  return data as CurrentSoilData
}
