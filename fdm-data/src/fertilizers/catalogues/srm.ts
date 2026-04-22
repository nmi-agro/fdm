import type {
    ApplicationMethods,
    ApplicationUnits,
    CatalogueFertilizer,
    CatalogueFertilizerItem,
} from "../d"
import { hashFertilizer } from "../hash"
import srm from "./srm.json"

/**
 * Retrieves the SRM (Sluiting Regionale Kringlopen) fertilizer catalogue.
 *
 * This function parses the `srm.json` file and transforms its data into a
 * structured `CatalogueFertilizer` array. It handles optional properties by
 * setting them to `null` if they are undefined in the JSON data.
 *
 * @returns An array of fertilizer catalogue entries conforming to the
 *          `CatalogueFertilizer` type.
 */
export async function getCatalogueSrm(): Promise<CatalogueFertilizer> {
    const catalogueSrmPromises = srm.map(async (fertilizer) => {
        const item: CatalogueFertilizerItem = {
            p_source: "srm",
            p_id_catalogue: fertilizer.p_id_catalogue,
            p_name_nl: fertilizer.p_name_nl,
            p_name_en: null,
            p_description: null,
            p_app_method_options:
                fertilizer.p_app_method_options === undefined
                    ? null
                    : (fertilizer.p_app_method_options.split(
                          "||",
                      ) as ApplicationMethods[]),
            p_app_amount_unit:
                (fertilizer as any).p_app_amount_unit === undefined
                    ? "kg/ha"
                    : ((fertilizer as any)
                          .p_app_amount_unit as ApplicationUnits),
            p_dm: fertilizer.p_dm === undefined ? null : fertilizer.p_dm,
            p_density:
                fertilizer.p_density === undefined
                    ? null
                    : fertilizer.p_density,
            p_om: fertilizer.p_om === undefined ? null : fertilizer.p_om,
            p_a: fertilizer.p_a === undefined ? null : fertilizer.p_a,
            p_hc: fertilizer.p_hc === undefined ? null : fertilizer.p_hc,
            p_eom: fertilizer.p_eom === undefined ? null : fertilizer.p_eom,
            p_eoc: fertilizer.p_eoc === undefined ? null : fertilizer.p_eoc,
            p_c_rt: null,
            p_c_of: fertilizer.p_c_of === undefined ? null : fertilizer.p_c_of,
            p_c_if: null,
            p_c_fr: fertilizer.p_c_fr === undefined ? null : fertilizer.p_c_fr,
            p_cn_of:
                fertilizer.p_cn_of === undefined ? null : fertilizer.p_cn_of,
            p_n_rt: fertilizer.p_n_rt === undefined ? null : fertilizer.p_n_rt,
            p_n_if: fertilizer.p_n_if === undefined ? null : fertilizer.p_n_if,
            p_n_of: fertilizer.p_n_of === undefined ? null : fertilizer.p_n_of,
            p_n_wc: fertilizer.p_n_wc === undefined ? null : fertilizer.p_n_wc,
            p_no3_rt:
                fertilizer.p_no3_rt === undefined ? null : fertilizer.p_no3_rt,
            p_nh4_rt:
                fertilizer.p_nh4_rt === undefined ? null : fertilizer.p_nh4_rt,
            p_p_rt: fertilizer.p_p_rt === undefined ? null : fertilizer.p_p_rt,
            p_k_rt: fertilizer.p_k_rt === undefined ? null : fertilizer.p_k_rt,
            p_mg_rt:
                fertilizer.p_mg_rt === undefined ? null : fertilizer.p_mg_rt,
            p_ca_rt:
                fertilizer.p_ca_rt === undefined ? null : fertilizer.p_ca_rt,
            p_ne: fertilizer.p_ne === undefined ? null : fertilizer.p_ne,
            p_s_rt: null,
            p_s_wc: null,
            p_cu_rt: null,
            p_zn_rt: null,
            p_na_rt: null,
            p_si_rt: null,
            p_b_rt: null,
            p_mn_rt: null,
            p_ni_rt: null,
            p_fe_rt: null,
            p_mo_rt: null,
            p_co_rt: null,
            p_as_rt: null,
            p_cd_rt: null,
            p_cr_rt: null,
            p_cr_vi: null,
            p_pb_rt: null,
            p_hg_rt: null,
            p_cl_rt: null,
            p_type_manure: fertilizer.p_type_manure,
            p_type_mineral: fertilizer.p_type_mineral,
            p_type_compost: fertilizer.p_type_compost,
            p_type_rvo:
                fertilizer.p_type_rvo === undefined
                    ? null
                    : String(fertilizer.p_type_rvo),
            hash: null,
        }

        // Hash the item
        item.hash = await hashFertilizer(item)

        return item
    })

    const catalogueSrm = await Promise.all(catalogueSrmPromises)
    return catalogueSrm
}
