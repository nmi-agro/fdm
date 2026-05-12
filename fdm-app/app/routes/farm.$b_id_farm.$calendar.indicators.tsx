import { getFarm, getFarms } from "@nmi-agro/fdm-core"
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
import { HeaderIndicators } from "~/components/blocks/header/indicators"
import { SidebarInset } from "~/components/ui/sidebar"
import { getSession } from "~/lib/auth.server"
import { clientConfig } from "~/lib/config"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"

export const meta: MetaFunction = () => {
    return [
        { title: `Indicatoren | ${clientConfig.name}` },
        {
            name: "description",
            content:
                "Bekijk de BLN3 bodemkwaliteitsindicatoren voor je percelen en bedrijf.",
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

        const session = await getSession(request)

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

        const calendar = params.calendar ?? ""

        return {
            farm,
            b_id_farm,
            calendar,
            farmOptions,
        }
    } catch (error) {
        const normalized = handleLoaderError(error)
        throw normalized ?? error
    }
}

export default function IndicatorsLayout() {
    const loaderData = useLoaderData<typeof loader>()
    const location = useLocation()
    const isKaart = location.pathname.includes("/kaart")

    const headerAction = {
        label: isKaart ? "Tabel" : "Kaart",
        to: isKaart
            ? `/farm/${loaderData.b_id_farm}/${loaderData.calendar}/indicators`
            : `/farm/${loaderData.b_id_farm}/${loaderData.calendar}/indicators/kaart`,
        disabled: false,
    }

    return (
        <SidebarInset>
            <Header action={headerAction}>
                <HeaderFarm
                    b_id_farm={loaderData.b_id_farm}
                    farmOptions={loaderData.farmOptions}
                />
                <HeaderIndicators b_id_farm={loaderData.b_id_farm} />
            </Header>
            <main className="min-w-0">
                <Outlet />
            </main>
        </SidebarInset>
    )
}
