import type { Fertilizer } from "@nmi-agro/fdm-core"
import type { z } from "zod"
import type { FormSchema } from "./formschema"

export type FertilizerKind = "manure" | "mineral" | "compost" | "renure" | "other"

/**
 * Derives the fertilizer category ("renure" | "mineral" | "compost" | "manure" | "other")
 * based on p_type_rvo (RVO mestcode).
 */
export function getFertilizerCategoryFromRvoCode(
  p_type_rvo?: string | null,
): FertilizerKind {
  if (p_type_rvo) {
    if (RENURE_RVO_CODES.includes(p_type_rvo)) return "renure"
    if (MINERAL_RVO_CODES.includes(p_type_rvo)) return "mineral"
    if (COMPOST_RVO_CODES.includes(p_type_rvo)) return "compost"
    if (MANURE_RVO_CODES.includes(p_type_rvo)) return "manure"
    if (OTHER_RVO_CODES.includes(p_type_rvo)) return "other"
  }
  return "other"
}

export function isRenureRvoCode(p_type_rvo?: string | null): boolean {
  return !!p_type_rvo && RENURE_RVO_CODES.includes(p_type_rvo)
}

/**
 * Builds the default values for the fertilizer form based on an existing fertilizer object.
 * Maps null values to undefined to match Zod schema expectations (string | undefined, number | undefined).
 */
export function buildFertilizerDefaults(
  fertilizer: Partial<Fertilizer>,
  clearName = false,
): z.infer<typeof FormSchema> {
  const toUndefined = (val: any) => (val === null || val === "" ? undefined : val)

  return {
    p_name_nl: clearName ? "" : (fertilizer.p_name_nl ?? ""),
    p_name_en: fertilizer.p_name_en ?? undefined,
    p_description: fertilizer.p_description ?? undefined,
    p_type_rvo: fertilizer.p_type_rvo ?? "",
    p_dm: toUndefined(fertilizer.p_dm),
    p_density: toUndefined(fertilizer.p_density),
    p_om: toUndefined(fertilizer.p_om),
    p_a: toUndefined(fertilizer.p_a),
    p_hc: toUndefined(fertilizer.p_hc),
    p_eom: toUndefined(fertilizer.p_eom),
    p_eoc: toUndefined(fertilizer.p_eoc),
    p_c_rt: toUndefined(fertilizer.p_c_rt),
    p_c_of: toUndefined(fertilizer.p_c_of),
    p_c_if: toUndefined(fertilizer.p_c_if),
    p_c_fr: toUndefined(fertilizer.p_c_fr),
    p_cn_of: toUndefined(fertilizer.p_cn_of),
    p_n_rt: toUndefined(fertilizer.p_n_rt),
    p_n_if: toUndefined(fertilizer.p_n_if),
    p_n_of: toUndefined(fertilizer.p_n_of),
    p_n_wc: toUndefined(fertilizer.p_n_wc),
    p_no3_rt: toUndefined(fertilizer.p_no3_rt),
    p_nh4_rt: toUndefined(fertilizer.p_nh4_rt),
    p_p_rt: toUndefined(fertilizer.p_p_rt),
    p_k_rt: toUndefined(fertilizer.p_k_rt),
    p_mg_rt: toUndefined(fertilizer.p_mg_rt),
    p_ca_rt: toUndefined(fertilizer.p_ca_rt),
    p_ne: toUndefined(fertilizer.p_ne),
    p_s_rt: toUndefined(fertilizer.p_s_rt),
    p_s_wc: toUndefined(fertilizer.p_s_wc),
    p_cu_rt: toUndefined(fertilizer.p_cu_rt),
    p_zn_rt: toUndefined(fertilizer.p_zn_rt),
    p_na_rt: toUndefined(fertilizer.p_na_rt),
    p_si_rt: toUndefined(fertilizer.p_si_rt),
    p_b_rt: toUndefined(fertilizer.p_b_rt),
    p_mn_rt: toUndefined(fertilizer.p_mn_rt),
    p_ni_rt: toUndefined(fertilizer.p_ni_rt),
    p_fe_rt: toUndefined(fertilizer.p_fe_rt),
    p_mo_rt: toUndefined(fertilizer.p_mo_rt),
    p_co_rt: toUndefined(fertilizer.p_co_rt),
    p_as_rt: toUndefined(fertilizer.p_as_rt),
    p_cd_rt: toUndefined(fertilizer.p_cd_rt),
    p_cr_rt: toUndefined(fertilizer.p_cr_rt),
    p_cr_vi: toUndefined(fertilizer.p_cr_vi),
    p_pb_rt: toUndefined(fertilizer.p_pb_rt),
    p_hg_rt: toUndefined(fertilizer.p_hg_rt),
    p_cl_rt: toUndefined(fertilizer.p_cl_rt),
    p_app_method_options: fertilizer.p_app_method_options || [],
    p_app_amount_unit: fertilizer.p_app_amount_unit || "kg/ha",
  }
}

/**
 * Builds the payload for adding a fertilizer to the catalogue.
 *
 * @param formValues - The values from the fertilizer form.
 * @param rvoToType - A mapping of RVO codes to fertilizer types.
 * @returns An object suitable for the addFertilizerToCatalogue function.
 */
export function buildCataloguePayload(
  formValues: z.infer<typeof FormSchema>,
  rvoToType?: Record<string, string>,
) {
  return {
    p_name_nl: formValues.p_name_nl,
    p_name_en: formValues.p_name_en,
    p_description: formValues.p_description,
    p_type: rvoToType?.[formValues.p_type_rvo ?? ""] ?? null,
    p_type_rvo: formValues.p_type_rvo,
    p_dm: formValues.p_dm,
    p_density: formValues.p_density,
    p_om: formValues.p_om,
    p_a: formValues.p_a,
    p_hc: formValues.p_hc,
    p_eom: formValues.p_eom,
    p_eoc: formValues.p_eoc,
    p_c_rt: formValues.p_c_rt,
    p_c_of: formValues.p_c_of,
    p_c_if: formValues.p_c_if,
    p_c_fr: formValues.p_c_fr,
    p_cn_of: formValues.p_cn_of,
    p_n_rt: formValues.p_n_rt,
    p_n_if: formValues.p_n_if,
    p_n_of: formValues.p_n_of,
    p_n_wc: formValues.p_n_wc,
    p_no3_rt: formValues.p_no3_rt,
    p_nh4_rt: formValues.p_nh4_rt,
    p_p_rt: formValues.p_p_rt,
    p_k_rt: formValues.p_k_rt,
    p_mg_rt: formValues.p_mg_rt,
    p_ca_rt: formValues.p_ca_rt,
    p_ne: formValues.p_ne,
    p_s_rt: formValues.p_s_rt,
    p_s_wc: formValues.p_s_wc,
    p_cu_rt: formValues.p_cu_rt,
    p_zn_rt: formValues.p_zn_rt,
    p_na_rt: formValues.p_na_rt,
    p_si_rt: formValues.p_si_rt,
    p_b_rt: formValues.p_b_rt,
    p_mn_rt: formValues.p_mn_rt,
    p_ni_rt: formValues.p_ni_rt,
    p_fe_rt: formValues.p_fe_rt,
    p_mo_rt: formValues.p_mo_rt,
    p_co_rt: formValues.p_co_rt,
    p_as_rt: formValues.p_as_rt,
    p_cd_rt: formValues.p_cd_rt,
    p_cr_rt: formValues.p_cr_rt,
    p_cr_vi: formValues.p_cr_vi,
    p_pb_rt: formValues.p_pb_rt,
    p_hg_rt: formValues.p_hg_rt,
    p_cl_rt: formValues.p_cl_rt,
    p_ef_nh3: undefined,
    p_app_method_options: formValues.p_app_method_options,
    p_app_amount_unit: formValues.p_app_amount_unit,
  }
}

export const fertilizerKindOptions: { p_type_rvo: string; p_type: FertilizerKind }[] = [
  { p_type_rvo: "10", p_type: "manure" },
  { p_type_rvo: "11", p_type: "manure" },
  { p_type_rvo: "12", p_type: "manure" },
  { p_type_rvo: "13", p_type: "manure" },
  { p_type_rvo: "14", p_type: "manure" },
  { p_type_rvo: "17", p_type: "manure" },
  { p_type_rvo: "18", p_type: "manure" },
  { p_type_rvo: "19", p_type: "manure" },
  { p_type_rvo: "23", p_type: "manure" },
  { p_type_rvo: "30", p_type: "manure" },
  { p_type_rvo: "31", p_type: "manure" },
  { p_type_rvo: "32", p_type: "manure" },
  { p_type_rvo: "33", p_type: "manure" },
  {
    p_type_rvo: "35",
    p_type: "manure",
  },
  {
    p_type_rvo: "39",
    p_type: "manure",
  },
  { p_type_rvo: "40", p_type: "manure" },
  { p_type_rvo: "41", p_type: "manure" },
  { p_type_rvo: "42", p_type: "manure" },
  { p_type_rvo: "43", p_type: "manure" },
  {
    p_type_rvo: "46",
    p_type: "manure",
  },
  { p_type_rvo: "50", p_type: "manure" },
  { p_type_rvo: "56", p_type: "manure" },
  { p_type_rvo: "60", p_type: "manure" },
  { p_type_rvo: "61", p_type: "manure" },
  { p_type_rvo: "75", p_type: "manure" },
  { p_type_rvo: "76", p_type: "manure" },
  { p_type_rvo: "80", p_type: "manure" },
  { p_type_rvo: "81", p_type: "manure" },
  { p_type_rvo: "90", p_type: "manure" },
  {
    p_type_rvo: "91",
    p_type: "manure",
  },
  { p_type_rvo: "92", p_type: "manure" },
  { p_type_rvo: "25", p_type: "manure" },
  { p_type_rvo: "26", p_type: "manure" },
  { p_type_rvo: "27", p_type: "manure" },
  { p_type_rvo: "95", p_type: "manure" },
  { p_type_rvo: "96", p_type: "manure" },
  { p_type_rvo: "97", p_type: "manure" },
  { p_type_rvo: "98", p_type: "manure" },
  { p_type_rvo: "99", p_type: "manure" },
  { p_type_rvo: "100", p_type: "manure" },
  { p_type_rvo: "101", p_type: "manure" },
  { p_type_rvo: "102", p_type: "manure" },
  { p_type_rvo: "103", p_type: "manure" },
  { p_type_rvo: "104", p_type: "manure" },
  { p_type_rvo: "105", p_type: "manure" },
  { p_type_rvo: "106", p_type: "manure" },
  { p_type_rvo: "107", p_type: "compost" },
  { p_type_rvo: "108", p_type: "compost" },
  { p_type_rvo: "109", p_type: "compost" },
  { p_type_rvo: "110", p_type: "manure" },
  { p_type_rvo: "111", p_type: "compost" },
  { p_type_rvo: "112", p_type: "compost" },
  { p_type_rvo: "113", p_type: "other" },
  { p_type_rvo: "114", p_type: "other" },
  { p_type_rvo: "115", p_type: "mineral" },
  { p_type_rvo: "116", p_type: "other" },
  { p_type_rvo: "117", p_type: "other" },
  {
    p_type_rvo: "120",
    p_type: "manure",
  },
  { p_type_rvo: "130", p_type: "renure" },
  { p_type_rvo: "131", p_type: "renure" },
  { p_type_rvo: "132", p_type: "renure" },
  { p_type_rvo: "133", p_type: "renure" },
  { p_type_rvo: "134", p_type: "renure" },
]

export const RENURE_RVO_CODES = fertilizerKindOptions
  .filter((option) => option.p_type === "renure")
  .map((option) => option.p_type_rvo)
export const MINERAL_RVO_CODES = fertilizerKindOptions
  .filter((option) => option.p_type === "mineral")
  .map((option) => option.p_type_rvo)
export const COMPOST_RVO_CODES = fertilizerKindOptions
  .filter((option) => option.p_type === "compost")
  .map((option) => option.p_type_rvo)
export const MANURE_RVO_CODES = fertilizerKindOptions
  .filter((option) => option.p_type === "manure")
  .map((option) => option.p_type_rvo)
export const OTHER_RVO_CODES = fertilizerKindOptions
  .filter((option) => option.p_type === "other")
  .map((option) => option.p_type_rvo)
