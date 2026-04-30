import { type MetaFunction, useLoaderData } from "react-router"
import { Header } from "~/components/blocks/header/base"
import {
    genericAction,
    loader,
} from "~/components/blocks/mijnpercelen/loader-and-action.server"
import { UploadMijnPercelenPage } from "~/components/blocks/mijnpercelen/upload-page"
import {
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbSeparator,
} from "~/components/ui/breadcrumb"
import { SidebarInset } from "~/components/ui/sidebar"
import { clientConfig } from "~/lib/config"
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

export { loader }

export function action(ctx: Route.LoaderArgs) {
    const { b_id_farm, calendar } = ctx.params
    return genericAction(ctx, `/farm/${b_id_farm}/${calendar}/rotation`)
}

export default function UpdateWithMijnPercelenPage() {
    const loaderData = useLoaderData<typeof loader>()

    return (
        <SidebarInset>
            <Header action={undefined}>
                <BreadcrumbItem className="hidden xl:block">
                    Bedrijf
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden xl:block" />
                <BreadcrumbItem>
                    {loaderData.b_name_farm ?? "Geen bedrijf geselecteerd"}
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbLink>Shapefile uploaden</BreadcrumbLink>
            </Header>
            <UploadMijnPercelenPage
                b_id_farm={loaderData.b_id_farm}
                calendar={loaderData.calendar}
                backUrl={`/farm/${loaderData.b_id_farm}`}
            />
        </SidebarInset>
    )
}
