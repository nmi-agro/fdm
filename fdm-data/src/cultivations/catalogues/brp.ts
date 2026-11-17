import type {
  AggregatedCultivationCatalogueInfo,
  CatalogueCultivationItem,
  CultivationCatalogueBuildingContext,
} from "../d"
import { hashCultivation } from "../hash"
import brp from "./brp.json"

/**
 * Aggregates information for the BRP catalogue.
 */
export async function aggregateCultivationCatalogueInfoBrp(
  buildingContext: CultivationCatalogueBuildingContext,
): Promise<AggregatedCultivationCatalogueInfo> {
  return aggregateCultivationCatalogueInfoBrpInternal(buildingContext, brp)
}

/**
 * Aggregates information for the BRP catalogue. The data source needs to be provided.
 */
export async function aggregateCultivationCatalogueInfoBrpInternal(
  buildingContext: CultivationCatalogueBuildingContext,
  data: typeof brp,
) {
  // Find the minimum and maximum availability year in the b_lu_ya entries.
  let firstAvailabilityYear: number | undefined = undefined
  let lastAvailabilityYear: number | undefined = undefined
  for (const cultivation of data) {
    const years = cultivation.b_lu_ya.split("||")
    for (const year of years) {
      const parsed = Number.parseInt(year)
      if (
        Number.isNaN(parsed) ||
        parsed < buildingContext.firstAllowedAvailabilityYear ||
        parsed > buildingContext.lastAllowedAvailabilityYear
      ) {
        continue
      }
      firstAvailabilityYear =
        typeof firstAvailabilityYear !== "undefined"
          ? Math.min(firstAvailabilityYear, parsed)
          : parsed
      lastAvailabilityYear =
        typeof lastAvailabilityYear !== "undefined"
          ? Math.max(lastAvailabilityYear, parsed)
          : parsed
    }
  }

  return {
    b_lu_ya_min: firstAvailabilityYear,
    b_lu_ya_max: lastAvailabilityYear,
  }
}

/**
 * Retrieves the BRP (Basisregistratie Perceel) cultivation catalogue.
 *
 * This function parses the `brp.json` file, transforms its data into a structured
 * `CatalogueCultivation` array, and performs validation on the `b_lu_harvestable`
 * property of each cultivation item.
 *
 * @returns An array of cultivation catalogue entries conforming to the `CatalogueCultivation` type.
 * @throws {Error} Throws an error if an invalid value is found for `b_lu_harvestable` in the JSON data.
 */
export async function getCatalogueBrp(
  buildingContext: CultivationCatalogueBuildingContext,
  aggregatedInfo: AggregatedCultivationCatalogueInfo,
) {
  const catalogueBrpPromises = brp.map(async (cultivation) => {
    // Validate b_lu_harvestable
    const harvestable =
      cultivation.b_lu_harvestable !== "once" &&
      cultivation.b_lu_harvestable !== "multiple" &&
      cultivation.b_lu_harvestable !== "none"
        ? (() => {
            throw new Error(
              `Invalid value for b_lu_harvestable: ${cultivation.b_lu_harvestable}. Expected 'eenmalig', 'meermalig' or 'niet'`,
            )
          })()
        : cultivation.b_lu_harvestable

    // Validate b_lu_croprotation
    const validCroprotations = [
      "other",
      "clover",
      "nature",
      "potato",
      "grass",
      "rapeseed",
      "starch",
      "maize",
      "cereal",
      "sugarbeet",
      "alfalfa",
      "catchcrop",
    ]
    if (!validCroprotations.includes(cultivation.b_lu_croprotation)) {
      throw new Error(`Invalid value for b_lu_croprotation: ${cultivation.b_lu_croprotation}.`)
    }

    // Validate harvestcat
    const harvestcat =
      cultivation.b_lu_harvestcat !== "HC010" &&
      cultivation.b_lu_harvestcat !== "HC020" &&
      cultivation.b_lu_harvestcat !== "HC031" &&
      cultivation.b_lu_harvestcat !== "HC040" &&
      cultivation.b_lu_harvestcat !== "HC041" &&
      cultivation.b_lu_harvestcat !== "HC042" &&
      cultivation.b_lu_harvestcat !== "HC050" &&
      cultivation.b_lu_harvestcat !== null
        ? (() => {
            throw new Error(`Invalid value for b_lu_harvestcat: ${cultivation.b_lu_harvestcat}.`)
          })()
        : cultivation.b_lu_harvestcat

    const yearsAvailable = [
      ...new Set(
        cultivation.b_lu_ya
          .split("||")
          .map((item) => Number.parseInt(item))
          .filter(
            (item) =>
              !Number.isNaN(item) &&
              item >= buildingContext.firstAllowedAvailabilityYear &&
              item <= buildingContext.lastAllowedAvailabilityYear,
          ),
      ),
    ]
    const b_lu_ya =
      yearsAvailable.length === 0 ||
      (typeof aggregatedInfo.b_lu_ya_min === "number" &&
        typeof aggregatedInfo.b_lu_ya_max === "number" &&
        yearsAvailable.length === aggregatedInfo.b_lu_ya_max - aggregatedInfo.b_lu_ya_min + 1)
        ? null
        : yearsAvailable.sort((a, b) => a - b)

    // Transform to CatalogueCultivationItem
    const item: CatalogueCultivationItem = {
      b_lu_source: "brp",
      b_lu_catalogue: cultivation.b_lu_catalogue,
      b_lu_name: cultivation.b_lu_name,
      b_lu_name_en: cultivation.b_lu_name_en,
      b_lu_harvestable: harvestable,
      b_lu_hcat3: cultivation.b_lu_hcat3,
      b_lu_hcat3_name: cultivation.b_lu_hcat3_name,
      b_lu_croprotation: cultivation.b_lu_croprotation as any,
      b_lu_harvestcat: harvestcat,
      b_lu_yield: cultivation.b_lu_yield,
      b_lu_dm: cultivation.b_lu_dm,
      b_lu_hi: cultivation.b_lu_hi,
      b_lu_eom: cultivation.b_lu_eom,
      b_lu_eom_residue: cultivation.b_lu_eom_residue,
      b_lu_n_harvestable: cultivation.b_lu_n_harvestable,
      b_lu_n_residue: cultivation.b_lu_n_residue,
      b_n_fixation: cultivation.b_n_fixation,
      b_lu_rest_oravib: cultivation.b_lu_rest_oravib,
      b_lu_variety_options:
        cultivation.b_lu_variety_options != null
          ? cultivation.b_lu_variety_options
              .split("||")
              .map((s) => s.trim())
              .filter((s) => s.length > 0)
          : null,
      b_lu_start_default:
        typeof cultivation.b_lu_start_default === "string" &&
        /^(0[1-9]|1[0-2])-(0[1-9]|[1-2][0-9]|3[0-1])$/.test(cultivation.b_lu_start_default.trim())
          ? cultivation.b_lu_start_default.trim()
          : null,
      b_date_harvest_default:
        typeof cultivation.b_date_harvest_default === "string" &&
        /^(0[1-9]|1[0-2])-(0[1-9]|[1-2][0-9]|3[0-1])$/.test(
          cultivation.b_date_harvest_default.trim(),
        )
          ? cultivation.b_date_harvest_default.trim()
          : null,
      b_lu_ya: b_lu_ya,
      hash: null,
    }

    // Hash the item
    item.hash = await hashCultivation(item)

    return item
  })

  const catalogueBrp = await Promise.all(catalogueBrpPromises)
  return catalogueBrp
}
