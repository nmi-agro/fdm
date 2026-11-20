import type { CurrentSoilData, SoilParameters } from "@nmi-agro/fdm-core"

/**
 * Builds the current soil data that fdm-core returns for a field with a single whole-field analysis.
 *
 * Parameters without a value (`null` or `undefined`) are left out, as fdm-core does.
 *
 * @param values - The value per soil parameter.
 * @param source - The analysis that the values come from.
 * @returns The current soil data of the field.
 */
export function currentSoilDataFixture(
  values: Partial<Record<SoilParameters, number | string | null>>,
  source: { a_id: string; b_sampling_date: Date | null } = {
    a_id: "soil1",
    b_sampling_date: new Date("2023-01-01"),
  },
): CurrentSoilData {
  return Object.entries(values)
    .filter(([, value]) => value !== null && value !== undefined)
    .map(([parameter, value]) => ({
      parameter: parameter as SoilParameters,
      value: value as number | string,
      is_aggregated: false,
      coverage: 1,
      has_coverage_warning: false,
      sources: [
        {
          a_id: source.a_id,
          a_source: "nl-other-nmi",
          b_sampling_date: source.b_sampling_date,
          a_depth_upper: 0,
          a_depth_lower: 30,
          value: value as number | string,
          area_fraction: 1,
        },
      ],
    }))
}
