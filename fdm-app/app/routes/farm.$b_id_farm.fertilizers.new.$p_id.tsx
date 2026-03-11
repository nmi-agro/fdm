import {
    getFarm,
    getFarms,
    getFertilizer,
    getFertilizerParametersDescription,
    getFertilizers,
} from "@nmi-agro/fdm-core"
import {
    data,
    type LoaderFunctionArgs,
    type MetaFunction,
    useLoaderData,
} from "react-router"
import { FarmNewFertilizerBlock } from "~/components/blocks/fertilizer/new-fertilizer-page"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { getSession } from "~/lib/auth.server"
import { clientConfig } from "~/lib/config"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { action as createFertilizerAction } from "./farm.$b_id_farm.fertilizers.new.custom"

export const meta: MetaFunction = () => {
    return [
        { title: `Meststof | ${clientConfig.name}` },
        {
            name: "description",
            content: "Bekijk de details van deze meststof",
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

        // Get RVO labels for the summary
        const fertilizerParameterDescription =
            getFertilizerParametersDescription("NL-nl")
        const p_type_rvo_options =
            fertilizerParameterDescription.find(
                (x) => x.parameter === "p_type_rvo",
            )?.options ?? []
        const rvoLabelByValue = new Map(
            p_type_rvo_options.map((opt) => [String(opt.value), opt.label]),
        )

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

        // Build mapping of RVO code to Type for dynamic badge colors
        const rvoToType: Record<string, string> = {}
        for (const f of fertilizers) {
            if (f.p_type_rvo && f.p_type) {
                rvoToType[f.p_type_rvo] = f.p_type
            }
        }

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
            rvoLabels: Object.fromEntries(rvoLabelByValue),
            rvoToType,
            clearName: true,
        }
    } catch (error) {
        throw handleLoaderError(error)
    }
}

/**
 * Renders the form for adding a new fertilizer based on an existing one.
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
                description={`Gebruik de gehaltes van ${loaderData.fertilizer.p_name_nl} als basis voor uw nieuwe meststof.`}
            />
            <div className="p-4 md:p-8 pt-0 md:pt-0">
                <div className="mx-auto max-w-6xl w-full">
                    <FarmNewFertilizerBlock loaderData={loaderData} />
                </div>
            </div>
        </div>
    )
}

export const action = createFertilizerAction
