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
import { FarmNewFertilizerBlock } from "~/components/blocks/fertilizer/new-fertilizer-page"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { FormSchema } from "~/components/blocks/fertilizer/formschema"
import { getRvoMappings } from "~/components/blocks/fertilizer/utils"
import { getSession } from "~/lib/auth.server"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { extractFormValuesFromRequest } from "~/lib/form"
import { isOfOrigin, modifySearchParams } from "~/lib/url-utils"
import type { z } from "zod"

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
            p_app_method_options: [],
            p_type: null as any,
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

        const { rvoLabels, rvoToType } = await getRvoMappings(fertilizers)

        // Return user information from loader
        return {
            fertilizerOptions: fertilizerOptions,
            fertilizer: fertilizer,
            fertilizerParameters: fertilizerParameters,
            editable: true,
            rvoLabels,
            rvoToType,
        }
    } catch (error) {
        throw handleLoaderError(error)
    }
}

/**
 * Renders the layout for creating a custom fertilizer.
 *
 * This component displays a sidebar that includes the farm header, navigation options, and a link to farm fields.
 * It also renders a main section containing the farm title, description, nested routes via an Outlet, and a notification toaster.
 */
export default function FarmFertilizerPage() {
    const loaderData = useLoaderData<typeof loader>()

    return (
        <div className="space-y-6">
            <FarmTitle
                title={"Nieuwe meststof"}
                description={
                    "Voer handmatig de gehaltes en eigenschappen in voor uw nieuwe meststof."
                }
            />
            <div className="p-4 md:p-8 pt-0 md:pt-0">
                <div className="mx-auto max-w-6xl w-full">
                    <FarmNewFertilizerBlock loaderData={loaderData} />
                </div>
            </div>
        </div>
    )
}

export function buildCataloguePayload(formValues: z.infer<typeof FormSchema>) {
    return {
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
    }
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
            buildCataloguePayload(formValues)
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
