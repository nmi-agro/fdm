import {
    type Fertilizer,
    getFertilizerParametersDescription,
} from "@nmi-agro/fdm-core"
import type { z } from "zod"
import type { FormSchema } from "./formschema"

/**
 * Builds the default values for the fertilizer form based on an existing fertilizer object.
 * Maps null values to undefined to match Zod schema expectations (string | undefined, number | undefined).
 */
export function buildFertilizerDefaults(
    fertilizer: Partial<Fertilizer>,
    clearName = false,
): z.infer<typeof FormSchema> {
    const toUndefined = (val: any) =>
        val === null || val === "" ? undefined : val

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
    }
}

/**
 * Retrieves RVO label and type mappings used across fertilizer forms and summaries.
 * Centralizes the assembly of RVO metadata from the parameter descriptions and available fertilizers.
 *
 * @param fertilizers - Optional array of fertilizers to build the RVO-to-Type mapping for dynamic badge colors.
 * @returns An object containing:
 *   - `rvoLabels`: A record mapping RVO codes to their descriptive labels (in Dutch).
 *   - `rvoToType`: A record mapping RVO codes to fertilizer types (manure, compost, etc.).
 */
export async function getRvoMappings(fertilizers: Partial<Fertilizer>[] = []) {
    const fertilizerParameterDescription =
        await getFertilizerParametersDescription("NL-nl")
    const p_type_rvo_options =
        fertilizerParameterDescription.find((x) => x.parameter === "p_type_rvo")
            ?.options ?? []

    const rvoLabels = Object.fromEntries(
        p_type_rvo_options.map((opt) => [String(opt.value), opt.label]),
    )

    const rvoToType: Record<string, string> = {}
    for (const f of fertilizers) {
        if (f.p_type_rvo && f.p_type) {
            rvoToType[f.p_type_rvo] = f.p_type
        }
    }

    return { rvoLabels, rvoToType }
}
