import { useLoaderData } from "react-router"
import { Ticket } from "~/components/blocks/helpdesk/ticket"
import { action, loader } from "~/components/blocks/helpdesk/ticket.server"

export { action, loader }

export default function DisplayedTicket() {
    const loaderData = useLoaderData<typeof loader>()
    const principalLookup = new Map(
        loaderData.principals.map((principal) => [
            principal.principal_id,
            principal,
        ]),
    )
    return <Ticket {...loaderData} principalLookup={principalLookup} />
}
