import { getFarm, getFarms, getFields } from "@nmi-agro/fdm-core"
import {
    data,
    type LoaderFunctionArgs,
    type MetaFunction,
    Outlet,
    useLoaderData,
    useLocation,
} from "react-router"
import { Header } from "~/components/blocks/header/base"
import { HeaderFarm } from "~/components/blocks/header/farm"
import { HeaderMineralization } from "~/components/blocks/header/mineralization"
import { SidebarInset } from "~/components/ui/sidebar"
import { getSession } from "~/lib/auth.server"
import { getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"

export const meta: MetaFunction = () => {
    return [
        { title: `Mineralisatie | ${clientConfig.name}` },
        {
            name: "description",
            content:
                "Bekijk de stikstofmineralisatie voor je percelen en bedrijf.",
        },
    ]
}

export async function loader({ request, params }: LoaderFunctionArgs) {
    try {
        const b_id_farm = params.b_id_farm
        if (!b_id_farm) {
            throw data("invalid: b_id_farm", {
                status: 400,
                statusText: "invalid: b_id_farm",
            })
        }

        const b_id = params.b_id

        const session = await getSession(request)
        const timeframe = getTimeframe(params)

        const farm = await getFarm(fdm, session.principal_id, b_id_farm)
        if (!farm) {
            throw data("not found: b_id_farm", {
                status: 404,
                statusText: "not found: b_id_farm",
            })
        }

        const farms = await getFarms(fdm, session.principal_id)
        if (!farms || farms.length === 0) {
            throw data("not found: farms", {
                status: 404,
                statusText: "not found: farms",
            })
        }

        const farmOptions = farms.map((f) => ({
            b_id_farm: f.b_id_farm,
            b_name_farm: f.b_name_farm,
        }))

        const fields = await getFields(
            fdm,
            session.principal_id,
            b_id_farm,
            timeframe,
        )
        const fieldOptions = fields
            .filter((field) => !field.b_bufferstrip)
            .map((field) => {
                if (!field?.b_id) throw new Error("Invalid field data")
                return {
                    b_id: field.b_id,
                    b_name: field.b_name,
                    b_area:
                        field.b_area != null
                            ? Math.round(field.b_area * 10) / 10
                            : 0,
                }
            })

        return {
            farm,
            b_id_farm,
            b_id,
            farmOptions,
            fieldOptions,
        }
    } catch (error) {
        throw handleLoaderError(error)
    }
}

export default function MineralizationLayout() {
    const loaderData = useLoaderData<typeof loader>()
    const location = useLocation()

    const isField = !!loaderData.b_id
    const isDyna = location.pathname.endsWith("/dyna")

    const title = isField
        ? isDyna
            ? "DYNA Dynamisch N-advies"
            : "Bodem N-levering"
        : "Mineralisatie"

    const description = isField
        ? isDyna
            ? "Gedetailleerde N-beschikbaarheid op basis van bodem, gewas en bemesting."
            : "Schatting van N-levering uit bodemorganische stof."
        : "Stikstofmineralisatie per perceel en bedrijf."

    return (
        <SidebarInset>
            <Header action={undefined}>
                <HeaderFarm
                    b_id_farm={loaderData.b_id_farm}
                    farmOptions={loaderData.farmOptions}
                />
                <HeaderMineralization
                    b_id_farm={loaderData.b_id_farm}
                    b_id={loaderData.b_id}
                    fieldOptions={loaderData.fieldOptions}
                />
            </Header>
            <main>
                <div className="space-y-6 py-5 px-10 pb-0">
                    <div className="flex items-center gap-4">
                        <div className="space-y-0.5">
                            <h2 className="text-2xl font-bold tracking-tight">
                                {title}
                            </h2>
                            <p className="text-muted-foreground">
                                {description}
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0">
                        <div className="flex-1">
                            <Outlet />
                        </div>
                    </div>
                </div>
            </main>
        </SidebarInset>
    )
}
