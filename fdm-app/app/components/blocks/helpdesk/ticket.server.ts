import { getPrincipals } from "@nmi-agro/fdm-core"
import {
    addMessage,
    assignTicket,
    checkHelpdeskPermission,
    getAgents,
    getAssigneesForTickets,
    getMessagesForTicket,
    getTicket,
    unassignTicket,
    updateTicketStatus,
} from "@nmi-agro/fdm-helpdesk"
import { dataWithSuccess } from "remix-toast"
import z from "zod"
import { getSession } from "@/app/lib/auth.server"
import { handleActionError, handleLoaderError } from "@/app/lib/error"
import { fdm } from "@/app/lib/fdm.server"
import { extractFormValuesFromRequest } from "@/app/lib/form"
import { AssigneeSchema } from "./assignee-schema"
import { MessageSchema } from "./message-schema"

interface Args {
    params: { ticket_id: string }
    request: Request
}
export async function loader({ params, request }: Args) {
    try {
        const session = await getSession(request)

        const [ticket, messages, canAddMessages, isAgent] = await Promise.all([
            getTicket(fdm, session.principal_id, params.ticket_id),
            getMessagesForTicket(fdm, session.principal_id, params.ticket_id),
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
        const agents = isAgent ? await getAgents(fdm, session.principal_id) : []

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
            isAgent: isAgent,
            principals: principalsSummarized,
            agents: agents,
        }
    } catch (err) {
        throw handleLoaderError(err)
    }
}

export const ActionSchema = z.discriminatedUnion("intent", [
    z.object({ intent: z.literal("set_ticket_status"), status: z.string() }),
    AssigneeSchema.extend({ intent: z.literal("change_assignment") }),
    MessageSchema.extend({ intent: z.literal("add_message") }),
])

export async function action({ params, request }: Args) {
    try {
        const session = await getSession(request)
        const formValues = await extractFormValuesFromRequest(
            request,
            ActionSchema,
        )

        if (formValues.intent === "set_ticket_status") {
            await updateTicketStatus(
                fdm,
                session.principal_id,
                params.ticket_id,
                formValues.status,
            )
        }

        if (formValues.intent === "change_assignment") {
            await fdm.transaction(async (tx) => {
                const currentAssignees =
                    (
                        await getAssigneesForTickets(tx, session.principal_id, [
                            params.ticket_id,
                        ])
                    ).get(params.ticket_id) ?? []

                const currentAssignment = new Map(
                    currentAssignees.map((assignee) => [
                        assignee.agent_id,
                        assignee,
                    ]),
                )
                const newAssignment = new Set(formValues.assignees)
                const newPrimary = new Set(formValues.primary)

                const queries = []

                for (const assignee of currentAssignees) {
                    if (!newAssignment.has(assignee.agent_id)) {
                        queries.push(
                            unassignTicket(
                                tx,
                                params.ticket_id,
                                assignee.agent_id,
                                session.principal_id,
                            ),
                        )
                    }
                }

                for (const agent_id of formValues.assignees) {
                    const currentAssignee = currentAssignment.get(agent_id)

                    if (
                        !currentAssignee ||
                        currentAssignee.is_primary !== newPrimary.has(agent_id)
                    ) {
                        queries.push(
                            assignTicket(
                                tx,
                                params.ticket_id,
                                agent_id,
                                session.principal_id,
                                newPrimary.has(agent_id),
                            ),
                        )
                    }
                }

                await Promise.all(queries)

                if (queries.length > 0) {
                    return dataWithSuccess("Toewijzing succesvol verandert!", {
                        message: "Toewijzing succesvol verandert!",
                    })
                }
            })
        }

        if (formValues.intent === "add_message") {
            console.log(formValues.body)
            await addMessage(
                fdm,
                params.ticket_id,
                session.principal_id,
                formValues.sender_role ?? "customer",
                formValues.body,
                formValues.is_internal,
            )

            return dataWithSuccess("Bericht ontgevangen!", {
                message: "Bericht ontgevangen!",
            })
        }
    } catch (err) {
        throw handleActionError(err)
    }
}
