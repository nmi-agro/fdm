import { useLoaderData } from "react-router"
import { TicketViewer } from "~/components/blocks/helpdesk/ticket-viewer"
import {
    type LoadPaginatedTicketsData,
    loadPaginatedTickets,
} from "~/components/blocks/helpdesk/ticket-viewer.server"
import type { Route } from "./+types/support._ticketviewer"

export async function loader({ request }: Route.LoaderArgs) {
    return await loadPaginatedTickets(request)
}

export default function PersonalTicketViewer() {
    const { tickets, totalTicketCount } =
        useLoaderData<LoadPaginatedTicketsData>()
    return (
        <TicketViewer
            tickets={tickets}
            totalTicketCount={totalTicketCount}
            toPrefix="/support/ticket"
        />
    )
}
