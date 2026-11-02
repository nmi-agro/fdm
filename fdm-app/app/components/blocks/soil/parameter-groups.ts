/**
 * Groups of soil parameters, shared by the soil analysis form and the read view of a soil
 * analysis, so that values are entered and shown in the same order.
 */

/** Parameters that describe how and where a soil analysis was sampled. */
export const SAMPLING_PARAMETERS = [
  "a_source",
  "b_sampling_date",
  "a_depth_upper",
  "a_depth_lower",
] as const

/** Sampling parameters that every soil analysis needs before it can be saved. */
export const REQUIRED_SAMPLING_PARAMETERS: readonly string[] = [
  "a_source",
  "b_sampling_date",
  "a_depth_lower",
]

/** A titled group of soil parameters. */
export interface SoilParameterGroup {
  id: string
  title: string
  parameters: readonly string[]
}

/** The soil parameter groups, in the order in which they are shown. */
export const SOIL_PARAMETER_GROUPS: readonly SoilParameterGroup[] = [
  { id: "sampling", title: "Monstername", parameters: SAMPLING_PARAMETERS },
  {
    id: "nitrogen-organic-matter",
    title: "Stikstof en organische stof",
    parameters: [
      "a_n_rt",
      "d_n_supply_base",
      "a_cn_fr",
      "a_n_pmn",
      "a_nmin_cc",
      "a_no3_cc",
      "a_nh4_cc",
      "a_som_loi",
      "a_c_of",
      "a_com_fr",
    ],
  },
  {
    id: "phosphate",
    title: "Fosfaat",
    parameters: ["a_p_al", "a_p_cc", "a_p_wa", "a_p_rt", "a_p_ox", "a_p_sg", "a_al_ox", "a_fe_ox"],
  },
  {
    id: "texture",
    title: "Textuur en bodemtype",
    parameters: [
      "a_clay_mi",
      "a_silt_mi",
      "a_sand_mi",
      "a_density_sa",
      "b_soiltype_agr",
      "b_gwl_class",
    ],
  },
  {
    id: "acidity-lime",
    title: "Zuurgraad en kalk",
    parameters: ["a_ph_cc", "a_caco3_if"],
  },
  {
    id: "sulfur-potassium-magnesium",
    title: "Zwavel, kalium en magnesium",
    parameters: ["a_s_rt", "a_k_cc", "a_mg_cc"],
  },
  {
    id: "cation-exchange",
    title: "Bezetting",
    parameters: [
      "a_cec_co",
      "a_ca_co",
      "a_ca_co_po",
      "a_k_co",
      "a_k_co_po",
      "a_mg_co",
      "a_mg_co_po",
    ],
  },
  { id: "trace", title: "Sporenelementen", parameters: ["a_zn_cc", "a_cu_cc"] },
]

/**
 * Splits soil parameters into the groups of {@link SOIL_PARAMETER_GROUPS}, keeping the order of
 * each group. Parameters that belong to no group end up in a final group "Overig". Empty groups
 * are left out.
 */
export function groupSoilParameters<T extends { parameter: string }>(
  items: readonly T[],
): { group: SoilParameterGroup; items: T[] }[] {
  const byParameter = new Map(items.map((item) => [item.parameter, item]))
  const grouped = new Set<string>()

  const result = SOIL_PARAMETER_GROUPS.map((group) => {
    const groupItems = group.parameters.flatMap((parameter) => {
      const item = byParameter.get(parameter)
      if (!item) return []
      grouped.add(parameter)
      return [item]
    })
    return { group, items: groupItems }
  })

  const rest = items.filter((item) => !grouped.has(item.parameter))
  result.push({ group: { id: "other", title: "Overig", parameters: [] }, items: rest })

  return result.filter((entry) => entry.items.length > 0)
}

const UNIT_REPLACEMENTS: [RegExp, string][] = [
  [/P2O5/g, "P₂O₅"],
  [/K2O/g, "K₂O"],
  [/CaCl2/g, "CaCl₂"],
  [/mmol\+/g, "mmol⁺"],
  [/cm3/g, "cm³"],
]

/**
 * Formats the unit of a soil parameter for display: chemical formulas get subscripts and
 * dimensionless parameters (unit `-`) get no unit at all.
 */
export function formatSoilUnit(unit: string | undefined | null): string {
  if (!unit || unit.trim() === "-") return ""
  return UNIT_REPLACEMENTS.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    unit,
  )
}

/**
 * Whether a parameter description adds something to its name. Descriptions that only repeat the
 * name are not shown.
 */
export function isInformativeDescription(name: string, description: string | undefined): boolean {
  if (!description) return false
  const normalize = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, "")
  return normalize(description) !== normalize(name)
}
