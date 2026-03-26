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
import { buildCataloguePayload } from "~/components/blocks/fertilizer/utils"
import { getRvoMappings } from "~/components/blocks/fertilizer/utils.server"
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

        const fertilizers = await getFertilizers(
            fdm,
            session.principal_id,
            b_id_farm,
        )
        const { rvoToType } = await getRvoMappings(fertilizers)

        const p_id_catalogue = await addFertilizerToCatalogue(
            fdm,
            session.principal_id,
            b_id_farm,
            buildCataloguePayload(formValues, rvoToType),
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
