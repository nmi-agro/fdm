import { getFarm, getPrincipals } from "@nmi-agro/fdm-core"
import {
  addMessage,
  addTagToTicket,
  assignTicket,
  checkHelpdeskPermission,
  createTag,
  getAgentAvailabilityStatuses,
  getAgents,
  getAssigneesForTickets,
  getMessagesForTicket,
  getTags,
  getTagsForTickets,
  getTicket,
  markTicketAsNotViewedByAll,
  markTicketAsViewed,
  removeTagFromTicket,
  unassignTicket,
  updateTicketPriority,
  updateTicketStatus,
  updateTicketSubject,
} from "@nmi-agro/fdm-helpdesk"
import { useLoaderData } from "react-router"
import { dataWithSuccess } from "remix-toast"
import z from "zod"
import { getSession } from "@/app/lib/auth.server"
import { sendHelpdeskNewMessageEmail } from "@/app/lib/email.server"
import { handleActionError, handleLoaderError } from "@/app/lib/error"
import { fdm } from "@/app/lib/fdm.server"
import { extractFormValuesFromRequest } from "@/app/lib/form"
import { AssigneeSchema } from "~/components/blocks/helpdesk/assignee-schema"
import { makeHelpdeskUser } from "~/components/blocks/helpdesk/helpdesk-user"
import { MessageSchema } from "~/components/blocks/helpdesk/message-schema"
import { notifyAboutReassignments } from "~/components/blocks/helpdesk/reassignment-notification.server"
import { TagSchema, TicketTagsSchema } from "~/components/blocks/helpdesk/tag-schema"
import { Ticket } from "~/components/blocks/helpdesk/ticket"
import {
  TicketPrioritySchema,
  TicketSubjectSchema,
} from "~/components/blocks/helpdesk/ticket-schema"

interface Args {
  params: { ticket_id: string }
  request: Request
}
export async function loader({ params, request }: Args) {
  try {
    const session = await getSession(request)

    const ticket = await getTicket(fdm, session.principal_id, params.ticket_id)
    const [messages, availableTags, canAddMessages, isAgent, isAdmin] = await Promise.all([
      getMessagesForTicket(fdm, session.principal_id, params.ticket_id),
      getTags(fdm),
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
      checkHelpdeskPermission(
        fdm,
        "helpdesk",
        "write",
        "",
        session.principal_id,
        "_ticketviewer.ticket.$ticket_id",
        false,
      ),
    ])

    // If the user is able to change the agent stuff on the ticket, load the necessary data for forms
    const agents = isAgent ? await getAgents(fdm, session.principal_id, { isActive: true }) : []
    // Combines absence + configured work days into one availability status per agent, so the UI
    // can never show an agent as available on a day they're absent or not scheduled to work.
    const agentAvailability = isAgent
      ? await getAgentAvailabilityStatuses(fdm, session.principal_id, agents)
      : undefined

    // Message sender's profile pictures are shown
    const principal_ids = messages
      .map((msg) => msg.sender_id)
      .filter((sender_id) => sender_id !== null)
    // Assignees' profile pictures are shown
    principal_ids.push(...ticket.assignees.map((assignee) => assignee.agent_id))
    // Currently logged-in user's profile picture is shown when creating a message
    principal_ids.push(session.principal_id)
    if (ticket.requester_id) principal_ids.push(ticket.requester_id)

    const principals = await getPrincipals(fdm, principal_ids)

    const agentInfo = new Map<string, { agent_id: string; display_name: string }>(
      ticket.assignees.map((assignee) => [assignee.agent_id, assignee]),
    )
    const otherAgentIds = new Set(
      messages.filter((msg) => msg.sender_type === "agent").map((msg) => msg.sender_id),
    )

    if (isAdmin) {
      const unresolvedAgentIds = [...otherAgentIds].filter(
        (id): id is string => typeof id === "string" && !agentInfo.has(id),
      )
      if (unresolvedAgentIds.length > 0) {
        // No `isActive` filter: as an admin, `getAgents` returns active and inactive agents alike.
        const allAgents = await getAgents(fdm, session.principal_id)
        for (const agent of allAgents) {
          if (unresolvedAgentIds.includes(agent.agent_id)) {
            agentInfo.set(agent.agent_id, {
              agent_id: agent.agent_id,
              display_name: agent.display_name,
            })
          }
        }
      }
    }

    const principalsSummarized = [...principals.values()].map((principal) => {
      // Agents should appear with their helpdesk display name
      if (agentInfo.has(principal.id) || otherAgentIds.has(principal.id)) {
        const found = agentInfo.get(principal.id)
        if (found) {
          return makeHelpdeskUser(found, principals)
        }
        return {
          principal_id: principal.id,
          displayUserName: "Onbekende medewerker",
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
    })

    return {
      principal_id: session.principal_id,
      ticket: ticket,
      messages: messages,
      availableTags: availableTags,
      canAddMessages: canAddMessages,
      isAgent: isAgent,
      principals: principalsSummarized,
      agents: agents,
      agentAvailability: agentAvailability,
      // To prevent hydration failed errors
      todayDate: new Date(),
      contextFarmName: ticket.context_farm_id
        ? await (async () => {
            // This leaks the farm info to the agent, but it should be fine as long as the helpdesk permission checks are run properly.
            const principal_id = [session.principal_id]
            if (ticket.requester_id) principal_id.push(ticket.requester_id)
            try {
              const farm = await getFarm(fdm, principal_id, ticket.context_farm_id as string)
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
  z.object({
    intent: z.literal("update_subject"),
    subject: TicketSubjectSchema,
  }),
  z.object({
    intent: z.literal("update_priority"),
    priority: TicketPrioritySchema,
  }),
  AssigneeSchema.extend({ intent: z.literal("change_assignment") }),
  MessageSchema.extend({ intent: z.literal("add_message") }),
  TagSchema.extend({ intent: z.literal("create_tag") }),
  TicketTagsSchema.extend({ intent: z.literal("set_tags") }),
])

export async function action({ params, request }: Args) {
  try {
    const session = await getSession(request)
    const formValues = await extractFormValuesFromRequest(request, ActionSchema)

    if (formValues.intent === "mark_ticket_as_viewed") {
      await markTicketAsViewed(fdm, session.principal_id, params.ticket_id)
    }

    if (formValues.intent === "set_ticket_status") {
      await updateTicketStatus(fdm, session.principal_id, params.ticket_id, formValues.status)

      return dataWithSuccess("De status is successvol bijgewerkt!", {
        message: "De status is successvol bijgewerkt!",
      })
    }

    if (formValues.intent === "update_subject") {
      await updateTicketSubject(fdm, session.principal_id, params.ticket_id, formValues.subject)

      return dataWithSuccess("Het onderwerp is succesvol bijgewerkt!", {
        message: "Het onderwerp is succesvol bijgewerkt!",
      })
    }

    if (formValues.intent === "update_priority") {
      await updateTicketPriority(fdm, session.principal_id, params.ticket_id, formValues.priority)

      return dataWithSuccess("De prioriteit is successvol bijgewerkt!", {
        message: "De prioriteit is successvol bijgewerkt!",
      })
    }

    if (formValues.intent === "change_assignment") {
      const result = await fdm.transaction(async (tx) => {
        const currentAssignees =
          (await getAssigneesForTickets(tx, session.principal_id, [params.ticket_id])).get(
            params.ticket_id,
          ) ?? []

        const currentAssignment = new Map(
          currentAssignees.map((assignee) => [assignee.agent_id, assignee]),
        )
        const newAssignment = new Set(formValues.assignees)
        const newPrimary = new Set(formValues.primary)

        // 1. unassign what is needed to be unassigned
        const unassigned = (
          await Promise.all(
            currentAssignees
              .filter((assignee) => !newAssignment.has(assignee.agent_id))
              .map(async (assignee) =>
                unassignTicket(tx, params.ticket_id, assignee.agent_id, session.principal_id),
              ),
          )
        ).length

        // 2. do the new assignments and updates
        const assigned = (
          await Promise.all(
            formValues.assignees
              .filter((agent_id) => {
                const currentAssignee = currentAssignment.get(agent_id)
                return !currentAssignee || currentAssignee.is_primary !== newPrimary.has(agent_id)
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

        // Agents who weren't assigned before this change; used below to email only genuinely new
        // assignees, not agents who were already on the ticket and just had `is_primary` toggled.
        const newlyAssignedAgentIds = formValues.assignees.filter(
          (agent_id) => !currentAssignment.has(agent_id),
        )

        return { unassigned, assigned, newlyAssignedAgentIds }
      })

      if (result.newlyAssignedAgentIds.length > 0) {
        try {
          const [ticket, assigneeSummaries] = await Promise.all([
            getTicket(fdm, session.principal_id, params.ticket_id),
            getAssigneesForTickets(fdm, session.principal_id, [params.ticket_id]),
          ])
          const newAssignees = (assigneeSummaries.get(params.ticket_id) ?? []).filter((assignee) =>
            result.newlyAssignedAgentIds.includes(assignee.agent_id),
          )

          await notifyAboutReassignments(
            session.principal_id,
            newAssignees.map((assignee) => ({ ...assignee, ticket })),
          )
        } catch (err) {
          // A failed notification email shouldn't fail the assignment itself.
          handleActionError(err)
        }
      }

      if (result.unassigned > 0 || result.assigned > 0) {
        return dataWithSuccess("Toewijzing succesvol verandert!", {
          message: "Toewijzing succesvol verandert!",
        })
      }

      // Have not done anything
      return null
    }

    if (formValues.intent === "create_tag") {
      await fdm.transaction(async (tx) => {
        // Create the tag
        const tag_id = await createTag(
          tx,
          session.principal_id,
          formValues.name,
          formValues.color,
          formValues.description,
        )

        // Also add the tag to the current ticket
        await addTagToTicket(tx, session.principal_id, params.ticket_id, tag_id)
      })

      return dataWithSuccess(null, {
        message: "Tag is successvol aangemaakt en toegevoegd!",
      })
    }

    if (formValues.intent === "set_tags") {
      await fdm.transaction(async (tx) => {
        const currentTags =
          (await getTagsForTickets(tx, session.principal_id, [params.ticket_id]))
            .get(params.ticket_id)
            ?.map((tag) => tag.tag_id) ?? []

        const currentTagsSet = new Set(currentTags)

        const newTags = formValues.tags
        const newTagsSet = new Set(newTags)

        // Resolve the difference between the two tag_id lists
        for (const current_tag_id of currentTags) {
          if (!newTagsSet.has(current_tag_id)) {
            await removeTagFromTicket(tx, session.principal_id, params.ticket_id, current_tag_id)
          }
        }

        for (const new_tag_id of newTags) {
          if (!currentTagsSet.has(new_tag_id)) {
            await addTagToTicket(tx, session.principal_id, params.ticket_id, new_tag_id)
          }
        }
      })
    }

    if (formValues.intent === "add_message") {
      const message_id = await addMessage(
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
          const ticket = await getTicket(fdm, session.principal_id, params.ticket_id)
          if (senderRole === "agent") {
            // Notify the customer (ticket requester)
            let foundRecipient: { displayUserName: string | null; email: string | null } | null =
              null
            if (ticket.requester_id) {
              const principals = await getPrincipals(fdm, [ticket.requester_id])
              const recipient = principals.get(ticket.requester_id)
              if (recipient) foundRecipient = recipient
            }
            if (!foundRecipient && ticket.requester_email) {
              foundRecipient = { displayUserName: null, email: ticket.requester_email }
            }

            if (foundRecipient?.email) {
              await sendHelpdeskNewMessageEmail(
                foundRecipient.email,
                foundRecipient.displayUserName ?? foundRecipient.email,
                ticket.assignees.find((assignee) => assignee.agent_id === session.principal_id)
                  ?.display_name ?? "Een medewerker",
                ticket.ticket_ref,
                ticket.subject ?? null,
                params.ticket_id,
                message_id,
                formValues.body,
              )
            }
          } else {
            // Notify the assigned agents when a customer sends a message
            if (ticket.assignees.length > 0) {
              const agentIds = ticket.assignees.map((a) => a.agent_id)
              const principals = await getPrincipals(fdm, [...agentIds, session.principal_id])
              const sender = principals.get(session.principal_id)
              await Promise.all(
                agentIds.map(async (agentId) => {
                  const agent = principals.get(agentId)
                  if (agent?.email) {
                    await sendHelpdeskNewMessageEmail(
                      agent.email,
                      agent.displayUserName ?? agent.email,
                      sender?.displayUserName ?? "Een gebruiker",
                      ticket.ticket_ref,
                      ticket.subject ?? null,
                      params.ticket_id,
                      message_id,
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
        void handleActionError(notificationErr)
      }

      try {
        await markTicketAsNotViewedByAll(fdm, params.ticket_id)
      } catch (unreadError) {
        // Marking as not read failed, but continue
        void handleActionError(unreadError)
      }

      return dataWithSuccess("Bericht ontvangen!", {
        message: "Bericht ontvangen!",
      })
    }
  } catch (err) {
    // extractFormValuesFromRequest calls handleActionError itself, so if that is detected to be the case,
    // return the response returned from it directly.
    if (err instanceof Promise) {
      const awaited = await (err as Promise<any>).catch(() => {})
      if (awaited?.type === "DataWithResponseInit") {
        return awaited
      }
    }

    throw handleActionError(err)
  }
}

export default function DisplayedTicket() {
  const loaderData = useLoaderData<typeof loader>()
  const principalLookup = new Map(
    loaderData.principals.map((principal) => [principal.principal_id, principal]),
  )
  return <Ticket {...loaderData} principalLookup={principalLookup} />
}
