import { type MetaFunction, useLoaderData } from "react-router"
import { Header } from "~/components/blocks/header/base"
import { HeaderFarmCreate } from "~/components/blocks/header/create-farm"
import {
    genericAction,
    loader,
} from "~/components/blocks/mijnpercelen/loader-and-action.server"
import { UploadMijnPercelenPage } from "~/components/blocks/mijnpercelen/upload-page"
import { SidebarInset } from "~/components/ui/sidebar"
import { clientConfig } from "~/lib/config"
import type { Route } from "./+types/farm.create.$b_id_farm.$calendar.upload"

export const handle = { hideNavigationProgress: true }

// Meta
export const meta: MetaFunction = () => {
    return [
        {
            title: `Shapefile uploaden - Bedrijf toevoegen | ${clientConfig.name}`,
        },
        {
            name: "description",
            content: "Upload een shapefile om percelen te importeren.",
        },
    ]
}

export { loader }

export function action(ctx: Route.LoaderArgs) {
    const { b_id_farm, calendar } = ctx.params
    return genericAction(ctx, `/farm/create/${b_id_farm}/${calendar}/fields`)
}

export default function CreateWithMijnPercelenPage() {
    const loaderData = useLoaderData<typeof loader>()

    return (
        <SidebarInset>
            <Header action={undefined}>
                <HeaderFarmCreate b_name_farm={loaderData.b_name_farm} />
            </Header>
            <UploadMijnPercelenPage
                b_id_farm={loaderData.b_id_farm}
                calendar={loaderData.calendar}
                backUrl={`/farm/create/${loaderData.b_id_farm}/${loaderData.calendar}`}
            />
        </SidebarInset>
    )
}
