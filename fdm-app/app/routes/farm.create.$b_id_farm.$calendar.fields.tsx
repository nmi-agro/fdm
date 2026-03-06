import { getCurrentSoilData, getFarm, getFields } from "@nmi-agro/fdm-core"
import {
    data,
    type LoaderFunctionArgs,
    type MetaFunction,
    NavLink,
    Outlet,
    useLoaderData,
} from "react-router"
import { NewFieldsSidebar } from "~/components/blocks/fields-new/sidebar"
import { Header } from "~/components/blocks/header/base"
import { HeaderFarmCreate } from "~/components/blocks/header/create-farm"
import { Button } from "~/components/ui/button"
import { Separator } from "~/components/ui/separator"
import { SidebarInset } from "~/components/ui/sidebar"
import { getSession } from "~/lib/auth.server"
import { getCalendar, getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { cn } from "~/lib/utils"

// Meta
export const meta: MetaFunction = () => {
    return [
        {
            title: `Percelen beheren - Bedrijf toevoegen | ${clientConfig.name}`,
        },
        {
            name: "description",
            content:
                "Beheer de percelen van je bedrijf. Pas namen aan en bekijk perceelsinformatie.",
        },
    ]
}

/**
 * Loads farm details, available fields, and map configuration for the field selection page.
 *
 * This loader function retrieves the farm ID from the route parameters and validates its presence. It then
 * fetches the farm details using the current session. Additionally, it loads the list of available fields
 * for the specified calendar year (or the current year if not provided) from an external source.
 * It also fetches available cultivation options from the catalogue.
 *
 * @param {LoaderFunctionArgs} args - The arguments for the loader function, including the request and parameters.
 * @returns {Promise<object>} An object containing farm details, the list of available fields, cultivation options, and other related data.
 * @throws {Response} If the farm ID is missing.
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
    try {
        // Get the Id and name of the farm
        const b_id_farm = params.b_id_farm
        if (!b_id_farm) {
            throw data("Farm ID is required", {
                status: 400,
                statusText: "Farm ID is required",
            })
        }

        // Get the session
        const session = await getSession(request)

        // Get timeframe from calendar store
        const calendar = getCalendar(params)
        const timeframe = getTimeframe(params)

        const farm = await getFarm(fdm, session.principal_id, b_id_farm)

        // Get the fields
        const fields = await getFields(
            fdm,
            session.principal_id,
            b_id_farm,
            timeframe,
        )

        // Get soil status for each field
        const soilStatus: Record<string, "estimated" | "measured" | "missing"> =
            {}

        await Promise.all(
            fields.map(async (field) => {
                const currentSoilData = await getCurrentSoilData(
                    fdm,
                    session.principal_id,
                    field.b_id,
                    timeframe,
                )

                if (currentSoilData.length === 0) {
                    soilStatus[field.b_id] = "missing"
                } else {
                    const sources = new Set(
                        currentSoilData.map((i) => i.a_source),
                    )
                    const hasMeasured = Array.from(sources).some(
                        (s) => s !== "nl-other-nmi",
                    )

                    if (hasMeasured) {
                        soilStatus[field.b_id] = "measured"
                    } else if (sources.has("nl-other-nmi")) {
                        soilStatus[field.b_id] = "estimated"
                    } else {
                        soilStatus[field.b_id] = "missing"
                    }
                }
            }),
        )

        return {
            fields: fields,
            soilStatus: soilStatus,
            b_id_farm: b_id_farm,
            b_name_farm: farm.b_name_farm,
            calendar: calendar,
        }
    } catch (error) {
        throw handleLoaderError(error)
    }
}

// Main
export default function Index() {
    const loaderData = useLoaderData<typeof loader>()
    const { fields, soilStatus, b_id_farm, b_name_farm, calendar } = loaderData

    return (
        <SidebarInset>
            <Header action={undefined}>
                <HeaderFarmCreate b_name_farm={b_name_farm} />
            </Header>
            <main>
                <div className="space-y-6 p-10 pb-16">
                    <div className="flex items-center">
                        <div className="space-y-0.5">
                            <h2 className="text-2xl font-bold tracking-tight">
                                Percelen
                            </h2>
                            <p className="text-muted-foreground">
                                Pas de naam aan, controleer het gewas en
                                bodemgegevens
                            </p>
                        </div>

                        <div className="ml-auto">
                            <NavLink
                                to={`/farm/create/${b_id_farm}/${calendar}/rotation`}
                                className={cn("ml-auto", {
                                    "pointer-events-none": fields.length === 0,
                                })}
                            >
                                <Button disabled={fields.length === 0}>
                                    Doorgaan
                                </Button>
                            </NavLink>
                        </div>
                    </div>
                    <Separator className="my-6" />
                    <div className="space-y-6 pb-0">
                        <div className="flex flex-col space-y-0 lg:flex-row lg:space-x-4 lg:space-y-0">
                            <NewFieldsSidebar
                                fields={fields}
                                soilStatus={soilStatus}
                                b_id_farm={b_id_farm}
                                calendar={calendar}
                                isFarmCreateWizard={true}
                            />
                            <div className="flex-1">
                                <Outlet />
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </SidebarInset>
    )
}
