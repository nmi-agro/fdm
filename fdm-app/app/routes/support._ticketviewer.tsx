import { useLoaderData } from "react-router"
import { TicketViewer } from "~/components/blocks/helpdesk/ticket-viewer"
import {
    type LoadPaginatedTicketsData,
    loadPaginatedTickets,
} from "~/components/blocks/helpdesk/ticket-viewer.server"
import { clientConfig } from "~/lib/config"
import type { Route } from "./+types/support._ticketviewer"

// Meta
export const meta: Route.MetaFunction = () => {
    return [
        {
            title: `Mijn Tickets - Ondersteuning | ${clientConfig.name}`,
        },
        {
            name: "description",
            content: "Bekijk en bewerk jouw tickets.",
        },
    ]
}

export async function loader({ request }: Route.LoaderArgs) {
    return await loadPaginatedTickets(request)
}

export default function PersonalTicketViewer() {
    const { tickets, totalTicketCount, principals } =
        useLoaderData<LoadPaginatedTicketsData>()

    const principalLookup = new Map(
        principals.map((principal) => [principal.principal_id, principal]),
    )
    return (
        <TicketViewer
            tickets={tickets}
            totalTicketCount={totalTicketCount}
            principalLookup={principalLookup}
            toPrefix="/support/ticket"
        />
    )
}
