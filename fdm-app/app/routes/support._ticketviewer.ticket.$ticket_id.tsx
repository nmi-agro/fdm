import { useLoaderData } from "react-router"
import { Ticket } from "~/components/blocks/helpdesk/ticket"
import { action, loader } from "~/components/blocks/helpdesk/ticket.server"

export { action, loader }

export default function DisplayedTicket() {
    const {
        principal_id,
        ticket,
        messages,
        agents,
        canAddMessages,
        isAgent,
        principals,
    } = useLoaderData<typeof loader>()
    const principalLookup = new Map(
        principals.map((principal) => [principal.principal_id, principal]),
    )
    return (
        <Ticket
            ticket={ticket}
            messages={messages}
            agents={agents}
            canAddMessages={canAddMessages}
            isAgent={isAgent}
            principal_id={principal_id}
            principalLookup={principalLookup}
            sender_role="customer"
        />
    )
}
