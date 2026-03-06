import { getFarm, getFarms, getFields } from "@nmi-agro/fdm-core"
import {
    data,
    type LoaderFunctionArgs,
    type MetaFunction,
    Outlet,
    useLoaderData,
} from "react-router"
import { HeaderBalance } from "~/components/blocks/header/balance"
import { Header } from "~/components/blocks/header/base"
import { HeaderFarm } from "~/components/blocks/header/farm"
import { SidebarInset } from "~/components/ui/sidebar"
import { getSession } from "~/lib/auth.server"
import { getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"

// Meta
export const meta: MetaFunction = () => {
    return [
        { title: `Organische Stof | Nutriëntenbalans| ${clientConfig.name}` },
        {
            name: "description",
            content: "Bekijk de organische stofbalans van je bedrijf.",
        },
    ]
}

/**
 * Loads farm details, farm options, and sidebar navigation items for a given farm.
 *
 * Retrieves the farm identifier from the route parameters, validates it, and uses the user's session from the request to
 * fetch the corresponding farm details. It also retrieves all farms associated with the user, mapping them into simplified
 * farm options. Additionally, it constructs sidebar page items for navigating to farm properties, access settings, and deletion.
 *
 * @param params - Route parameters; must include a valid `b_id_farm`.
 * @returns An object containing the farm details, the farm identifier, an array of farm options, and an array of sidebar page items.
 *
 * @throws {Response} If `b_id_farm` is missing from the parameters.
 * @throws {Response} If no farm matches the provided `b_id_farm`.
 * @throws {Response} If no farms associated with the user are found.
 */
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

        // Get the field id
        const b_id = params.b_id

        // Get the session
        const session = await getSession(request)

        // Get timeframe from calendar store
        const timeframe = getTimeframe(params)

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

        // Get the fields to be selected
        const fields = await getFields(
            fdm,
            session.principal_id,
            b_id_farm,
            timeframe,
        )
        const fieldOptions = fields
            .filter((field) => !field.b_bufferstrip)
            .map((field) => {
                if (!field?.b_id || !field?.b_name) {
                    throw new Error("Invalid field data structure")
                }
                return {
                    b_id: field.b_id,
                    b_name: field.b_name,
                    b_area: Math.round(field.b_area * 10) / 10,
                }
            })

        // Return user information from loader
        return {
            farm: farm,
            b_id_farm: b_id_farm,
            b_id: b_id,
            farmOptions: farmOptions,
            fieldOptions: fieldOptions,
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
export default function FarmBalanceOrganicMatterBlock() {
    const loaderData = useLoaderData<typeof loader>()

    return (
        <SidebarInset>
            <Header action={undefined}>
                <HeaderFarm
                    b_id_farm={loaderData.b_id_farm}
                    farmOptions={loaderData.farmOptions}
                />
                <HeaderBalance
                    b_id_farm={loaderData.b_id_farm}
                    b_id={loaderData.b_id}
                    fieldOptions={loaderData.fieldOptions}
                />
            </Header>
            <main>
                <div className="space-y-6 py-5 px-10 pb-0">
                    <div className="flex items-center gap-4">
                        <div className="space-y-0.5 ">
                            <h2 className="text-2xl font-bold tracking-tight">
                                Organische stof
                            </h2>
                        </div>
                    </div>
                    <div className="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0">
                        <div className="flex-1">{<Outlet />}</div>
                    </div>
                </div>
            </main>
        </SidebarInset>
    )
}
