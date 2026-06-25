import { getFarms, getFields } from "@nmi-agro/fdm-core"
import { MapIcon } from "lucide-react"
import { NavLink, Outlet, useLoaderData } from "react-router"
import { HeaderAtlas } from "~/components/blocks/header/atlas"
import { Header } from "~/components/blocks/header/base"
import { HeaderFarm } from "~/components/blocks/header/farm"
import { HeaderField } from "~/components/blocks/header/field"
import { Button } from "~/components/ui/button"
import { SidebarInset } from "~/components/ui/sidebar"
import { getSession } from "~/lib/auth.server"
import { getTimeframe } from "~/lib/calendar"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import type { Route } from "./+types/farm.$b_id_farm.$calendar.atlas_.soil-analysis.$b_id"

export async function loader({ params, request }: Route.LoaderArgs) {
    try {
        const session = await getSession(request)
        const { b_id_farm, calendar, b_id } = params
        const timeframe = getTimeframe(params)

        // Get the fields to be selected
        const fields = await getFields(
            fdm,
            session.principal_id,
            b_id_farm,
            timeframe,
        )
        if (!fields.some((field) => field.b_id === b_id)) {
            throw new Error(`Field ${b_id} does not belong to this farm.`)
        }
        const fieldOptions = fields.map((field) => {
            if (!field?.b_id || !field?.b_name) {
                throw new Error("Invalid field data structure")
            }
            return {
                b_id: field.b_id,
                b_name: field.b_name,
                b_area: Math.round((field.b_area ?? 0) * 10) / 10,
            }
        })

        // Get a list of possible farms of the user
        const farms = await getFarms(fdm, session.principal_id)

        const farmOptions = farms.map((farm) => {
            return {
                b_id_farm: farm.b_id_farm,
                b_name_farm: farm.b_name_farm,
            }
        })

        return {
            b_id_farm: b_id_farm,
            b_id: b_id,
            calendar: calendar,
            farmOptions: farmOptions,
            fieldOptions: fieldOptions,
        }
    } catch (e) {
        throw handleLoaderError(e)
    }
}

export default function AtlasSoilAnalysisFieldDetailLayout() {
    const { b_id_farm, calendar, b_id, farmOptions, fieldOptions } =
        useLoaderData<typeof loader>()

    const action = {
        to: `/farm/${b_id_farm}/${calendar}/atlas/soil-analysis`,
        label: "Terug naar atlas",
        disabled: false,
    }

    return (
        <SidebarInset>
            <Header action={action}>
                <HeaderFarm b_id_farm={b_id_farm} farmOptions={farmOptions} />
                <HeaderAtlas b_id_farm={b_id_farm} />
                <HeaderField
                    b_id_farm={b_id_farm}
                    b_id={b_id}
                    fieldOptions={fieldOptions}
                    compact
                />
            </Header>
            <main className="p-6">
                <Outlet />
                <div className="fixed bottom-6 right-6 z-50">
                    <Button
                        asChild
                        size="lg"
                        className="rounded-full shadow-lg"
                    >
                        <NavLink
                            to={`/farm/${b_id_farm}/${calendar}/atlas/soil-analysis`}
                        >
                            <MapIcon className="mr-2 h-4 w-4" />
                            Terug naar kaart
                        </NavLink>
                    </Button>
                </div>
            </main>
        </SidebarInset>
    )
}
