import { getFarm, getFarms } from "@nmi-agro/fdm-core"
import {
    data,
    type LoaderFunctionArgs,
    type MetaFunction,
    Outlet,
    useLoaderData,
    useSearchParams,
} from "react-router"
import { redirectWithError } from "remix-toast"
import { Header } from "~/components/blocks/header/base"
import { HeaderFarm } from "~/components/blocks/header/farm"
import { HeaderFertilizer } from "~/components/blocks/header/fertilizer"
import { SidebarInset } from "~/components/ui/sidebar"
import { getSession } from "~/lib/auth.server"
import { clientConfig } from "~/lib/config"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { isOfOrigin } from "~/lib/url-utils"
import type { Route } from "./+types/farm.$b_id_farm.fertilizers.new"

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

        const requestUrl = new URL(request.url)
        const returnUrl =
            requestUrl.searchParams.get("returnUrl") ??
            `/farm/${b_id_farm}/fertilizers`

        if (!isOfOrigin(returnUrl, requestUrl.origin)) {
            return redirectWithError(
                `/farm/${b_id_farm}/fertilizers`,
                `Return URL ${returnUrl} is niet ondersteund.`,
            )
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
                b_name_farm: farm.b_name_farm || "",
            }
        })

        // Return user information from loader
        return {
            farm: farm,
            b_id_farm: b_id_farm,
            farmOptions: farmOptions,
        }
    } catch (error) {
        throw handleLoaderError(error)
    }
}

/**
 * Renders the layout for adding a new fertilizer.
 *
 * This component displays a sidebar that includes the farm header, navigation options, and a link to farm fields.
 * It also renders a main section containing the farm title, description, nested routes via an Outlet, and a notification toaster.
 */
export default function FarmFertilizerBlock({ params }: Route.ComponentProps) {
    const [searchParams] = useSearchParams()
    const loaderData = useLoaderData<typeof loader>()

    const returnUrl = searchParams.get("returnUrl")

    return (
        <SidebarInset>
            <Header
                action={
                    returnUrl
                        ? {
                              label: "Terug naar bemesting toevoegen",
                              to: returnUrl,
                              disabled: false,
                          }
                        : {
                              to: `/farm/${loaderData.b_id_farm}/fertilizers`,
                              label: "Terug naar overzicht",
                              disabled: false,
                          }
                }
            >
                <HeaderFarm
                    b_id_farm={loaderData.b_id_farm}
                    farmOptions={loaderData.farmOptions}
                />
                <HeaderFertilizer
                    b_id_farm={loaderData.b_id_farm}
                    p_id={undefined}
                    fertilizerOptions={[]}
                />
            </Header>
            <main>
                <div className="space-y-6">
                    <Outlet />
                </div>
            </main>
        </SidebarInset>
    )
}
