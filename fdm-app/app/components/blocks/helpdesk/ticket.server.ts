import { getFarm, getPrincipals } from "@nmi-agro/fdm-core"
import {
    addMessage,
    assignTicket,
    checkHelpdeskPermission,
    getAgents,
    getAssigneesForTickets,
    getMessagesForTicket,
    getTicket,
    markTicketAsNotViewedByAll,
    markTicketAsViewed,
    unassignTicket,
    updateTicketStatus,
} from "@nmi-agro/fdm-helpdesk"
import { dataWithSuccess } from "remix-toast"
import z from "zod"
import { getSession } from "@/app/lib/auth.server"
import { sendHelpdeskNewMessageEmail } from "@/app/lib/email.server"
import { handleActionError, handleLoaderError } from "@/app/lib/error"
import { fdm } from "@/app/lib/fdm.server"
import { extractFormValuesFromRequest } from "@/app/lib/form"
import { AssigneeSchema } from "./assignee-schema"
import { makeHelpdeskUser } from "./helpdesk-user"
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

        const agentInfo = new Map<
            string,
            { agent_id: string; display_name: string }
        >(ticket.assignees.map((assignee) => [assignee.agent_id, assignee]))
        const otherAgentIds = new Set(
            messages
                .filter((msg) => msg.sender_type === "agent")
                .map((msg) => msg.sender_id),
        )

        const principalsSummarized = [...principals.values()].map(
            (principal) => {
                // Agents should appear with their helpdesk display name
                if (
                    agentInfo.has(principal.id) ||
                    otherAgentIds.has(principal.id)
                ) {
                    const found = agentInfo.get(principal.id)
                    if (found) {
                        return makeHelpdeskUser(found, principals)
                    }
                    return {
                        principal_id: principal.id,
                        displayUserName: "Onbekende Medewerker",
                        initials: "OM",
                        image: null,
                    }
                }
                return {
                    principal_id: principal.id,
                    displayUserName: principal.displayUserName,
                    initials: principal.initials,
                    image: principal.image,
                }
            },
        )

        return {
            principal_id: session.principal_id,
            ticket: ticket,
            messages: messages,
            canAddMessages: canAddMessages,
            isAgent: isAgent,
            principals: principalsSummarized,
            agents: agents,
            // To prevent hydration failed errors
            todayDate: new Date(),
            contextFarmName: ticket.context_farm_id
                ? await (async () => {
                      try {
                          const farm = await getFarm(
                              fdm,
                              session.principal_id,
                              ticket.context_farm_id as string,
                          )
                          return farm.b_name_farm ?? null
                      } catch {
                          return null
                      }
                  })()
                : null,
        }
    } catch (err) {
        throw handleLoaderError(err)
    }
}

export const ActionSchema = z.discriminatedUnion("intent", [
    z.object({ intent: z.literal("mark_ticket_as_viewed") }),
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

        if (formValues.intent === "mark_ticket_as_viewed") {
            await markTicketAsViewed(
                fdm,
                session.principal_id,
                params.ticket_id,
            )
        }

        if (formValues.intent === "set_ticket_status") {
            await updateTicketStatus(
                fdm,
                session.principal_id,
                params.ticket_id,
                formValues.status,
            )
        }

        if (formValues.intent === "change_assignment") {
            return await fdm.transaction(async (tx) => {
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

                // 1. unassign what is needed to be unassigned
                const unassigned = (
                    await Promise.all(
                        currentAssignees
                            .filter(
                                (assignee) =>
                                    !newAssignment.has(assignee.agent_id),
                            )
                            .map(async (assignee) =>
                                unassignTicket(
                                    tx,
                                    params.ticket_id,
                                    assignee.agent_id,
                                    session.principal_id,
                                ),
                            ),
                    )
                ).length

                // 2. do the new assignments and updates
                const assigned = (
                    await Promise.all(
                        formValues.assignees
                            .filter((agent_id) => {
                                const currentAssignee =
                                    currentAssignment.get(agent_id)
                                return (
                                    !currentAssignee ||
                                    currentAssignee.is_primary !==
                                        newPrimary.has(agent_id)
                                )
                            })
                            .map(async (agent_id) =>
                                assignTicket(
                                    tx,
                                    params.ticket_id,
                                    agent_id,
                                    session.principal_id,
                                    newPrimary.has(agent_id),
                                ),
                            ),
                    )
                ).length

                if (unassigned > 0 || assigned > 0) {
                    return dataWithSuccess("Toewijzing succesvol verandert!", {
                        message: "Toewijzing succesvol verandert!",
                    })
                }

                // Have not done anything
                return null
            })
        }

        if (formValues.intent === "add_message") {
            await addMessage(
                fdm,
                params.ticket_id,
                session.principal_id,
                formValues.sender_role ?? "customer",
                formValues.body,
                formValues.is_internal,
            )

            // Send email notification to the other party (non-internal messages only)
            try {
                if (!formValues.is_internal) {
                    const senderRole = formValues.sender_role ?? "customer"
                    const ticket = await getTicket(
                        fdm,
                        session.principal_id,
                        params.ticket_id,
                    )

                    if (senderRole === "agent") {
                        // Notify the customer (ticket requester)
                        if (ticket.requester_id) {
                            const principals = await getPrincipals(fdm, [
                                ticket.requester_id,
                            ])
                            const recipient = principals.get(
                                ticket.requester_id,
                            )
                            if (recipient?.email) {
                                await sendHelpdeskNewMessageEmail(
                                    recipient.email,
                                    recipient.displayUserName ??
                                        recipient.email,
                                    ticket.assignees.find(
                                        (assignee) =>
                                            assignee.agent_id ===
                                            session.principal_id,
                                    )?.display_name ?? "Een medewerker",
                                    ticket.ticket_ref,
                                    ticket.subject ?? null,
                                    params.ticket_id,
                                    formValues.body,
                                )
                            }
                        }
                    } else {
                        // Notify the assigned agents when a customer sends a message
                        if (ticket.assignees.length > 0) {
                            const agentIds = ticket.assignees.map(
                                (a) => a.agent_id,
                            )
                            const principals = await getPrincipals(fdm, [
                                ...agentIds,
                                session.principal_id,
                            ])
                            const sender = principals.get(session.principal_id)
                            await Promise.all(
                                agentIds.map(async (agentId) => {
                                    const agent = principals.get(agentId)
                                    if (agent?.email) {
                                        await sendHelpdeskNewMessageEmail(
                                            agent.email,
                                            agent.displayUserName ??
                                                agent.email,
                                            sender?.displayUserName ??
                                                "Een gebruiker",
                                            ticket.ticket_ref,
                                            ticket.subject ?? null,
                                            params.ticket_id,
                                            formValues.body,
                                        )
                                    }
                                }),
                            )
                        }
                    }
                }
            } catch (notificationErr) {
                // Sending the emails failed, but continue
                handleActionError(notificationErr)
            }

            try {
                await markTicketAsNotViewedByAll(fdm, params.ticket_id)
            } catch (unreadError) {
                // Marking as not read failed, but continue
                handleActionError(unreadError)
            }

            return dataWithSuccess("Bericht ontgevangen!", {
                message: "Bericht ontgevangen!",
            })
        }
    } catch (err) {
        throw handleActionError(err)
    }
}
