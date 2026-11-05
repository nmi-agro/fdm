import type { CurrentSoilData } from "@nmi-agro/fdm-core"
import { calculateNlv } from "./nlv-supply"

/**
 * Adds the base nitrogen supplying capacity (`d_n_supply_base`, NLV) to current soil data when
 * it has no measured value, by calculating it from soil organic matter (`a_som_loi`), clay
 * (`a_clay_mi`) and the C/N ratio (`a_cn_fr`). Items for `d_n_supply_base` without a value are
 * removed. When one of the three inputs is missing, no NLV is added.
 *
 * The NLV is a field-level calculation from soil organic matter, clay and C/N (for fields with
 * zones their area-weighted means): it gets one source "calculated" ("Berekend") and no coverage of
 * its own.
 *
 * @param currentSoilData - The current soil parameter values of a field.
 * @returns A new array with the NLV added when it could be calculated.
 * @example
 * ```ts
 * const soil = enrichCurrentSoilDataWithNlv(await getCurrentSoilData(fdm, principal_id, b_id))
 * ```
 */
export function enrichCurrentSoilDataWithNlv(currentSoilData: CurrentSoilData): CurrentSoilData {
  const data = currentSoilData.filter(
    (item) => item.parameter !== "d_n_supply_base" || item.value != null,
  )
  const hasNlv = data.some((item) => item.parameter === "d_n_supply_base" && item.value != null)
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
      // NLV is calculated from the field values of three inputs (for fields with zones their
      // area-weighted means), so it is a single field-level value: one calculated source (dated
      // like the newest input), not a value per zone. It shows no coverage of its own; the
      // coverage is shown with the inputs themselves.
      const inputs = [somItem, clayItem, cnItem]
      const newestSource = inputs
        .map((input) => input.sources[0])
        .sort(
          (a, b) =>
            (b.b_sampling_date ? new Date(b.b_sampling_date).getTime() : 0) -
            (a.b_sampling_date ? new Date(a.b_sampling_date).getTime() : 0),
        )[0]
      data.push({
        parameter: "d_n_supply_base",
        value: nlvVal,
        is_aggregated: false,
        coverage: null,
        has_coverage_warning: false,
        sources: [{ ...newestSource, a_source: "calculated", value: nlvVal, area_fraction: 1 }],
      })
    }
  }
  return data as CurrentSoilData
}
