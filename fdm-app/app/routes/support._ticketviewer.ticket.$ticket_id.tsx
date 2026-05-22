import { getPrincipals } from "@nmi-agro/fdm-core"
import {
    addMessage,
    checkHelpdeskPermission,
    getAgents,
    getMessagesForTicket,
    getTicket,
} from "@nmi-agro/fdm-helpdesk"
import { useLoaderData } from "react-router"
import z from "zod"
import { AssigneeSchema } from "~/components/blocks/helpdesk/assignee-schema"
import { MessageBodySchema } from "~/components/blocks/helpdesk/message-schema"
import { Ticket } from "~/components/blocks/helpdesk/ticket"
import { getSession } from "~/lib/auth.server"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { extractFormValuesFromRequest } from "~/lib/form"
import type { Route } from "./+types/support._ticketviewer.ticket.$ticket_id"

export async function loader({ params, request }: Route.LoaderArgs) {
    try {
        const session = await getSession(request)

        const [ticket, messages, canAddMessages, canAddAssignees] =
            await Promise.all([
                getTicket(fdm, session.principal_id, params.ticket_id),
                getMessagesForTicket(
                    fdm,
                    session.principal_id,
                    params.ticket_id,
                ),
                checkHelpdeskPermission(
                    fdm,
                    "ticket-user-side",
                    "write",
                    params.ticket_id,
                    session.principal_id,
                    "_ticketviewer.ticket.$ticket_id",
                    false,
                ),
                checkHelpdeskPermission(
                    fdm,
                    "ticket-agent-side",
                    "write",
                    params.ticket_id,
                    session.principal_id,
                    "_ticketviewer.ticket.$ticket_id",
                    false,
                ),
            ])

        // If the user is able to change the agent stuff on the ticket, load the necessary data for forms
        const agents = canAddAssignees
            ? await getAgents(fdm, session.principal_id)
            : []

        // Message sender's profile pictures are shown
        const principal_ids = messages.map((msg) => msg.sender_id)
        // Assignees' profile pictures are shown
        principal_ids.push(
            ...ticket.assignees.map((assignee) => assignee.agent_id),
        )
        // Currently logged-in user's profile picture is shown when creating a message
        principal_ids.push(session.principal_id)
        if (ticket.requester_id) principal_ids.push(ticket.requester_id)

        const principals = await getPrincipals(fdm, principal_ids)

        const principalsSummarized = [...principals.values()].map(
            (principal) => ({
                principal_id: principal.id,
                displayUserName: principal.displayUserName,
                initials: principal.initials,
                image: principal.image,
            }),
        )

        return {
            principal_id: session.principal_id,
            ticket: ticket,
            messages: messages,
            canAddMessages: canAddMessages,
            canAddAssignees: canAddAssignees,
            principals: principalsSummarized,
            agents: agents,
        }
    } catch (err) {
        throw handleLoaderError(err)
    }
}

const ActionSchema = z.discriminatedUnion("intent", [
    z.object({ intent: z.literal("add_message"), body: MessageBodySchema }),
    AssigneeSchema.extend({ intent: z.literal("change_assignment") }),
])

export async function action({ params, request }: Route.ActionArgs) {
    try {
        const session = await getSession(request)
        console.log([...(await request.clone().formData()).entries()])
        const formValues = await extractFormValuesFromRequest(
            request,
            ActionSchema,
        )

        if (formValues.intent === "add_message") {
            await addMessage(
                fdm,
                params.ticket_id,
                session.principal_id,
                "customer",
                formValues.body,
            )
        }
    } catch (err) {
        throw handleActionError(err)
    }
}

export default function DisplayedTicket() {
    const {
        principal_id,
        ticket,
        messages,
        agents,
        canAddMessages,
        canAddAssignees,
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
            canAddAssignees={canAddAssignees}
            principal_id={principal_id}
            principalLookup={principalLookup}
            sender_role="customer"
        />
    )
}
