import {
    addFertilizer,
    addFertilizerToCatalogue,
    getFarm,
    getFarms,
    getFertilizer,
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
import { FarmNewFertilizerBlock } from "~/components/blocks/fertilizer/new-fertilizer-page"
import { getSession } from "~/lib/auth.server"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { extractFormValuesFromRequest } from "~/lib/form"
import { isOfOrigin, modifySearchParams } from "~/lib/url-utils"

export const meta: MetaFunction = () => {
    return [
        { title: `Meststof | ${clientConfig.name}` },
        {
            name: "description",
            content: "Bekij de details van deze meststof",
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

        // Get the fertilizer id
        const p_id = params.p_id
        if (!p_id) {
            throw data("invalid: p_id", {
                status: 400,
                statusText: "invalid: p_id",
            })
        }

        // Get the session
        const session = await getSession(request)

        // Get details of farm
        const farm = await getFarm(fdm, session.principal_id, b_id_farm)
        if (!farm) {
            throw data("not found: b_id_farm", {
                status: 404,
                statusText: "not found: b_id_farm",
            })
        }

        // Get a list of possible farms of the user
        const farms = await getFarms(fdm, session.principal_id)
        if (!farms || farms.length === 0) {
            throw data("not found: farms", {
                status: 404,
                statusText: "not found: farms",
            })
        }

        const farmOptions = farms.map((farm) => {
            return {
                b_id_farm: farm.b_id_farm,
                b_name_farm: farm.b_name_farm,
            }
        })

        // Get selected fertilizer
        const fertilizer = await getFertilizer(fdm, p_id)
        const fertilizerParameters = getFertilizerParametersDescription()

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
            farm: farm,
            p_id: p_id,
            b_id_farm: b_id_farm,
            farmOptions: farmOptions,
            fertilizerOptions: fertilizerOptions,
            fertilizer: fertilizer,
            editable: true,
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

    return <FarmNewFertilizerBlock loaderData={loaderData} />
}

export async function action({ request, params }: ActionFunctionArgs) {
    try {
        const b_id_farm = params.b_id_farm
        const p_id = params.p_id

        if (!b_id_farm) {
            throw new Error("missing: b_id_farm")
        }
        if (!p_id) {
            throw new Error("missing: p_id")
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
