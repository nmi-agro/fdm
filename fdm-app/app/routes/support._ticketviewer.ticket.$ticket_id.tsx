import { getMessagesForTicket, getTicket } from "@nmi-agro/fdm-helpdesk"
import { useLoaderData } from "react-router"
import { Ticket } from "~/components/blocks/helpdesk/ticket"
import { getSession } from "~/lib/auth.server"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import type { Route } from "./+types/support._ticketviewer.ticket.$ticket_id"

export async function loader({ params, request }: Route.LoaderArgs) {
    try {
        const session = await getSession(request)

        const [ticket, messages] = await Promise.all([
            getTicket(fdm, session.principal_id, params.ticket_id),
            getMessagesForTicket(fdm, session.principal_id, params.ticket_id),
        ])

        return {
            ticket: ticket,
            messages: messages,
        }
    } catch (err) {
        throw handleLoaderError(err)
    }
}

export default function DisplayedTicket() {
    const { ticket, messages } = useLoaderData<typeof loader>()
    return <Ticket ticket={ticket} messages={messages} />
}
