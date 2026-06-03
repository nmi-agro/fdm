import { getFarms } from "@nmi-agro/fdm-core"
import { createTicket } from "@nmi-agro/fdm-helpdesk"
import { useLoaderData } from "react-router"
import { redirectWithSuccess } from "remix-toast"
import type { FarmOptions } from "~/components/blocks/farm/farm"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { TicketComposer } from "~/components/blocks/helpdesk/ticket-composer"
import { TicketSchema } from "~/components/blocks/helpdesk/ticket-schema"
import { getSession } from "~/lib/auth.server"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { extractFormValuesFromRequest } from "~/lib/form"
import type { Route } from "./+types/support.new"

// Meta
export const meta: Route.MetaFunction = () => {
    return [
        {
            title: `Nieuw ticket - Ondersteuning | ${clientConfig.name}`,
        },
        {
            name: "description",
            content: "Stel een vraag of meld een probleem. Een medewerker neemt binnen enkele werkdagen contact met u op.",
        },
    ]
}

export async function loader({ request }: Route.LoaderArgs) {
    try {
        let farmOptions: FarmOptions = []
        const url = new URL(request.url)

        try {
            const session = await getSession(request)
            const farms = await getFarms(fdm, session.principal_id)

            farmOptions = farms.map((farm) => ({
                b_id_farm: farm.b_id_farm,
                b_name_farm: farm.b_name_farm,
            }))
        } catch (err) {
            handleLoaderError(err)
        }

        return {
            farmOptions: farmOptions,
            initial_context_farm_id: url.searchParams.get("context_farm_id"),
        }
    } catch (err) {
        throw handleLoaderError(err)
    }
}

export async function action({ request }: Route.ActionArgs) {
    try {
        const session = await getSession(request)

        const ticketCreateInfo = await extractFormValuesFromRequest(
            request,
            TicketSchema,
        )

        await createTicket(fdm, session.principal_id, ticketCreateInfo.body, {
            context: {
                b_id_farm: ticketCreateInfo.context_farm_id,
            },
        })

        return redirectWithSuccess(
            "/support",
            "We hebben uw vraag ontvangen. Een collega neemt binnenkort contact met u op.",
        )
    } catch (err) {
        throw handleActionError(err)
    }
}

export default function NewTicket() {
    const { farmOptions, initial_context_farm_id } =
        useLoaderData<typeof loader>()
    return (
        <main className="p-6">
            <FarmTitle
                title="Nieuw ticket"
                description="Stel uw vraag of meld een probleem. Een medewerker neemt doorgaans binnen enkele werkdagen contact met u op."
            />
            <TicketComposer
                farmOptions={farmOptions}
                initial_context_farm_id={initial_context_farm_id}
            />
        </main>
    )
}
