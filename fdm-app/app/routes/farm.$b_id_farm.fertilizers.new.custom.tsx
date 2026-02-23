import {
    addFertilizer,
    addFertilizerToCatalogue,
    getFertilizerParametersDescription,
    getFertilizers,
} from "@nmi-agro/fdm-core"
import {
    type ActionFunctionArgs,
    data,
    type LoaderFunctionArgs,
    type MetaFunction,
    useLoaderData,
} from "react-router"
import { redirectWithSuccess } from "remix-toast"
import { FormSchema } from "~/components/blocks/fertilizer/formschema"
import { FarmNewCustomFertilizerBlock } from "~/components/blocks/fertilizer/new-custom-fertilizer-page"
import { getSession } from "~/lib/auth.server"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { extractFormValuesFromRequest } from "~/lib/form"
import { isOfOrigin, modifySearchParams } from "~/lib/url-utils"

export const meta: MetaFunction = () => {
    return [
        { title: `Meststof toevoegen | ${clientConfig.name}` },
        {
            name: "description",
            content:
                "Voeg een meststof toe om deze te gebruiken op dit bedrijf.",
        },
    ]
}

export async function loader({ request, params }: LoaderFunctionArgs) {
    try {
        // Get the farm id
        const b_id_farm = params.b_id_farm
        if (!b_id_farm) {
            throw data("invalid: b_id_farm", {
                status: 400,
                statusText: "invalid: b_id_farm",
            })
        }

        // Get the session
        const session = await getSession(request)

        // Get selected fertilizer
        const fertilizerParameters = getFertilizerParametersDescription()

        const fertilizer = {
            p_id: undefined, // Added p_id
            p_source: b_id_farm,
            p_name_nl: "",
            p_type_rvo: undefined,
            p_dm: undefined,
            p_density: undefined,
            p_om: undefined,
            p_a: undefined,
            p_hc: undefined,
            p_eom: undefined,
            p_eoc: undefined,
            p_c_rt: undefined,
            p_c_of: undefined,
            p_c_if: undefined,
            p_c_fr: undefined,
            p_cn_of: undefined,
            p_n_rt: undefined,
            p_n_if: undefined,
            p_n_of: undefined,
            p_n_wc: undefined,
            p_no3_rt: undefined,
            p_nh4_rt: undefined,
            p_p_rt: undefined,
            p_k_rt: undefined,
            p_mg_rt: undefined,
            p_ca_rt: undefined,
            p_ne: undefined,
            p_s_rt: undefined,
            p_s_wc: undefined,
            p_cu_rt: undefined,
            p_zn_rt: undefined,
            p_na_rt: undefined,
            p_si_rt: undefined,
            p_b_rt: undefined,
            p_mn_rt: undefined,
            p_ni_rt: undefined,
            p_fe_rt: undefined,
            p_mo_rt: undefined,
            p_co_rt: undefined,
            p_as_rt: undefined,
            p_cd_rt: undefined,
            p_cr_rt: undefined,
            p_cr_vi: undefined,
            p_pb_rt: undefined,
            p_hg_rt: undefined,
            p_cl_rt: undefined,
            p_app_method_options: [],
        }

        // Get the available fertilizers
        const fertilizers = await getFertilizers(
            fdm,
            session.principal_id,
            b_id_farm,
        )
        const fertilizerOptions = fertilizers.map((fertilizer) => {
            return {
                p_id: fertilizer.p_id,
                p_name_nl: fertilizer.p_name_nl,
            }
        })

        // Return user information from loader
        return {
            fertilizerOptions: fertilizerOptions,
            fertilizer: fertilizer,
            fertilizerParameters: fertilizerParameters,
        }
    } catch (error) {
        throw handleLoaderError(error)
    }
}

/**
 * Renders the layout for managing farm settings.
 *
 * This component displays a sidebar that includes the farm header, navigation options, and a link to farm fields.
 * It also renders a main section containing the farm title, description, nested routes via an Outlet, and a notification toaster.
 */
export default function FarmFertilizerPage() {
    const loaderData = useLoaderData<typeof loader>()

    return <FarmNewCustomFertilizerBlock loaderData={loaderData} />
}

export async function action({ request, params }: ActionFunctionArgs) {
    try {
        const b_id_farm = params.b_id_farm

        if (!b_id_farm) {
            throw new Error("missing: b_id_farm")
        }

        const requestUrl = new URL(request.url)
        const returnUrl =
            requestUrl.searchParams.get("returnUrl") ??
            `/farm/${b_id_farm}/fertilizers`

        const session = await getSession(request)
        const formValues = await extractFormValuesFromRequest(
            request,
            FormSchema,
        )

        const p_id_catalogue = await addFertilizerToCatalogue(
            fdm,
            session.principal_id,
            b_id_farm,
            {
                p_name_nl: formValues.p_name_nl,
                p_name_en: formValues.p_name_en,
                p_description: formValues.p_description,
                p_type: null,
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
            },
        )

        const p_new_id = await addFertilizer(
            fdm,
            session.principal_id,
            p_id_catalogue,
            b_id_farm,
            undefined,
            undefined,
        )

        return redirectWithSuccess(
            isOfOrigin(returnUrl, requestUrl.origin)
                ? modifySearchParams(returnUrl, (searchParams) =>
                      searchParams.set("p_id", p_new_id),
                  )
                : `/farm/${b_id_farm}/fertilizers`,
            {
                message: `${formValues.p_name_nl} is toegevoegd! 🎉`,
            },
        )
    } catch (error) {
        throw handleActionError(error)
    }
}
