import { zodResolver } from "@hookform/resolvers/zod"
import type { Fertilizer } from "@nmi-agro/fdm-core"
import { useRemixForm } from "remix-hook-form"
import type { z } from "zod"
import {
    FertilizerForm,
    type FertilizerParameterDescriptionItem,
} from "@/app/components/blocks/fertilizer/form"
import { FormSchema } from "~/components/blocks/fertilizer/formschema"

interface FarmNewFertilizerBlockLoaderData {
    fertilizer: Fertilizer
    fertilizerParameters: FertilizerParameterDescriptionItem[]
    editable: boolean
}

/**
 * Renders the new fertilizer form based off of an existing farm.
 *
 * Users on the add field fertilizer form can now directly navigate to the fertilizer management page, then come back when they are done.
 */
export function FarmNewFertilizerBlock({
    loaderData,
}: {
    loaderData: FarmNewFertilizerBlockLoaderData
}) {
    const { fertilizer, fertilizerParameters, editable } = loaderData

    const form = useRemixForm<z.infer<typeof FormSchema>>({
        mode: "onTouched",
        resolver: zodResolver(FormSchema),
        defaultValues: {
            p_name_nl: "",
            p_type_rvo: fertilizer.p_type_rvo,
            p_dm: fertilizer.p_dm,
            p_density: fertilizer.p_density,
            p_om: fertilizer.p_om,
            p_a: fertilizer.p_a,
            p_hc: fertilizer.p_hc,
            p_eom: fertilizer.p_eom,
            p_eoc: fertilizer.p_eoc,
            p_c_rt: fertilizer.p_c_rt,
            p_c_of: fertilizer.p_c_of,
            p_c_if: fertilizer.p_c_if,
            p_c_fr: fertilizer.p_c_fr,
            p_cn_of: fertilizer.p_cn_of,
            p_n_rt: fertilizer.p_n_rt,
            p_n_if: fertilizer.p_n_if,
            p_n_of: fertilizer.p_n_of,
            p_n_wc: fertilizer.p_n_wc,
            p_no3_rt: fertilizer.p_no3_rt,
            p_nh4_rt: fertilizer.p_nh4_rt,
            p_p_rt: fertilizer.p_p_rt,
            p_k_rt: fertilizer.p_k_rt,
            p_mg_rt: fertilizer.p_mg_rt,
            p_ca_rt: fertilizer.p_ca_rt,
            p_ne: fertilizer.p_ne,
            p_s_rt: fertilizer.p_s_rt,
            p_s_wc: fertilizer.p_s_wc,
            p_cu_rt: fertilizer.p_cu_rt,
            p_zn_rt: fertilizer.p_zn_rt,
            p_na_rt: fertilizer.p_na_rt,
            p_si_rt: fertilizer.p_si_rt,
            p_b_rt: fertilizer.p_b_rt,
            p_mn_rt: fertilizer.p_mn_rt,
            p_ni_rt: fertilizer.p_ni_rt,
            p_fe_rt: fertilizer.p_fe_rt,
            p_mo_rt: fertilizer.p_mo_rt,
            p_co_rt: fertilizer.p_co_rt,
            p_as_rt: fertilizer.p_as_rt,
            p_cd_rt: fertilizer.p_cd_rt,
            p_cr_rt: fertilizer.p_cr_rt,
            p_cr_vi: fertilizer.p_cr_vi,
            p_pb_rt: fertilizer.p_pb_rt,
            p_hg_rt: fertilizer.p_hg_rt,
            p_cl_rt: fertilizer.p_cl_rt,
            p_app_method_options: fertilizer.p_app_method_options,
        },
    })

    return (
        <FertilizerForm
            fertilizerParameters={fertilizerParameters}
            form={form}
            editable={editable}
        />
    )
}
