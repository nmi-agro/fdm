import type {
    ApplicationMethods,
    ApplicationUnits,
    CatalogueFertilizer,
    CatalogueFertilizerItem,
} from "../d"
import { hashFertilizer } from "../hash"
import baat from "./baat.json"

/**
 * Retrieves the BAAT (Betere Akkerbouw Adviezen Toekomstgericht) fertilizer catalogue.
 *
 * This function parses the `baat.json` file and transforms its data into a
 * structured `CatalogueFertilizer` array. It handles optional properties by
 * setting them to `null` if they are undefined in the JSON data.
 *
 * @returns An array of fertilizer catalogue entries conforming to the
 *          `CatalogueFertilizer` type.
 */
export async function getCatalogueBaat(): Promise<CatalogueFertilizer> {
    const catalogueBaatPromises = baat.map(async (fertilizer) => {
        const item: CatalogueFertilizerItem = {
            p_source: "baat",
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
                fertilizer.p_app_amount_unit === undefined
                    ? "kg/ha"
                    : (fertilizer.p_app_amount_unit as ApplicationUnits),
            p_ef_nh3:
                fertilizer.p_ef_nh3 === undefined ? null : fertilizer.p_ef_nh3,
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
            p_cn_of: null,
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
            p_s_rt: fertilizer.p_s_rt === undefined ? null : fertilizer.p_s_rt,
            p_s_wc: null,
            p_cu_rt:
                fertilizer.p_cu_rt === undefined ? null : fertilizer.p_cu_rt,
            p_zn_rt:
                fertilizer.p_zn_rt === undefined ? null : fertilizer.p_zn_rt,
            p_na_rt:
                fertilizer.p_na_rt === undefined ? null : fertilizer.p_na_rt,
            p_si_rt: null,
            p_b_rt: fertilizer.p_b_rt === undefined ? null : fertilizer.p_b_rt,
            p_mn_rt:
                fertilizer.p_mn_rt === undefined ? null : fertilizer.p_mn_rt,
            p_ni_rt: null,
            p_fe_rt: null,
            p_mo_rt:
                fertilizer.p_mo_rt === undefined ? null : fertilizer.p_mo_rt,
            p_co_rt:
                fertilizer.p_co_rt === undefined ? null : fertilizer.p_co_rt,
            p_as_rt: null,
            p_cd_rt: null,
            p_cr_rt: null,
            p_cr_vi: null,
            p_pb_rt: null,
            p_hg_rt: null,
            p_cl_rt: null,
            p_ne: null,
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

    const catalogueBaat = await Promise.all(catalogueBaatPromises)
    return catalogueBaat
}
