import { getFarms } from "@nmi-agro/fdm-core"
import { type MetaFunction, useLoaderData } from "react-router"
import { Header } from "~/components/blocks/header/base"
import {
    genericAction,
    loader as genericLoader,
} from "~/components/blocks/mijnpercelen/loader-and-action.server"
import { UploadMijnPercelenPage } from "~/components/blocks/mijnpercelen/upload-page"
import { SidebarInset } from "~/components/ui/sidebar"
import { clientConfig } from "~/lib/config"
import { HeaderFarm } from "../components/blocks/header/farm"
import { getSession } from "../lib/auth.server"
import { handleLoaderError } from "../lib/error"
import { fdm } from "../lib/fdm.server"
import type { Route } from "./+types/farm.$b_id_farm.$calendar.upload"

export const handle = { hideNavigationProgress: true }

// Meta
export const meta: MetaFunction = () => {
    return [
        {
            title: `Shapefile uploaden - Bedrijf | ${clientConfig.name}`,
        },
        {
            name: "description",
            content: "Upload een shapefile om percelen te importeren.",
        },
    ]
}

async function specificLoader({ request }: Route.LoaderArgs) {
    try {
        const session = await getSession(request)
        // Get a list of possible farms of the user
        const farms = await getFarms(fdm, session.principal_id)
        const farmOptions = farms.map((farm) => {
            return {
                b_id_farm: farm.b_id_farm,
                b_name_farm: farm.b_name_farm,
            }
        })

        return { farmOptions }
    } catch (e) {
        throw handleLoaderError(e)
    }
}

export async function loader(ctx: Route.LoaderArgs) {
    const [genericLoaderData, specificLoaderData] = await Promise.all([
        genericLoader(ctx),
        specificLoader(ctx),
    ])
    return { ...genericLoaderData, ...specificLoaderData }
}

export function action(ctx: Route.LoaderArgs) {
    const { b_id_farm, calendar } = ctx.params
    return genericAction(ctx, `/farm/${b_id_farm}/${calendar}/field`)
}

export default function UpdateWithMijnPercelenPage() {
    const loaderData = useLoaderData<typeof loader>()

    return (
        <SidebarInset>
            <Header action={undefined}>
                <HeaderFarm
                    b_id_farm={loaderData.b_id_farm}
                    farmOptions={loaderData.farmOptions}
                />
            </Header>
            <UploadMijnPercelenPage
                backUrl={`/farm/${loaderData.b_id_farm}`}
                returnUrl={`/farm/${loaderData.b_id_farm}/${loaderData.calendar}/fields`}
            />
        </SidebarInset>
    )
}
