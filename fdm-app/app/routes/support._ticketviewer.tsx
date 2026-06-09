import { useLoaderData } from "react-router"
import { TicketViewer } from "~/components/blocks/helpdesk/ticket-viewer"
import {
    type LoadPaginatedTicketsData,
    loadPaginatedTickets,
} from "~/components/blocks/helpdesk/ticket-viewer.server"
import { clientConfig } from "~/lib/config"
import type { Route } from "./+types/support._ticketviewer"

// Meta
export const meta: Route.MetaFunction = ({ loaderData }) => {
    const suffix = ` - Ondersteuning | ${clientConfig.name}`

    if (loaderData.defaultFilterType === "all") {
        return [
            {
                title: `Alle tickets${suffix}`,
            },
            {
                name: "description",
                content: "Bekijk en bewerk tickets.",
            },
        ]
    }

    if (loaderData.defaultFilterType === "inbox") {
        return [
            {
                title: `Mijn inbox${suffix}`,
            },
            {
                name: "description",
                content: "Bekijk en bewerk jouw tickets.",
            },
        ]
    }

    if (loaderData.defaultFilterType === "unassigned") {
        return [
            {
                title: `Niet toegewezen${suffix}`,
            },
            {
                name: "description",
                content:
                    "Bekijk en bewerk de tickets die nog niet toegewezen zijn.",
            },
        ]
    }

    return [
        {
            title: `Mijn tickets${suffix}`,
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
    const {
        tickets,
        totalTicketCount,
        principals,
        helpdeskReadPermission,
        availableTags,
    } = useLoaderData<LoadPaginatedTicketsData>()

    const principalLookup = new Map(
        principals.map((principal) => [principal.principal_id, principal]),
    )
    return (
        <TicketViewer
            tickets={tickets}
            totalTicketCount={totalTicketCount}
            principalLookup={principalLookup}
            toPrefix="/support/ticket"
            helpdeskReadPermission={helpdeskReadPermission}
            availableTags={availableTags}
        />
    )
}
