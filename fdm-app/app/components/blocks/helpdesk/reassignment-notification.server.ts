import { getPrincipals } from "@nmi-agro/fdm-core"
import { getMessagesForTicket, TicketReassignment } from "@nmi-agro/fdm-helpdesk"
import { sendHelpdeskNewMessageEmail } from "~/lib/email.server"
import { handleActionError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"

/**
 * Maximum number of emails to send per agent when they might get assigned multiple tickets at once.
 * It is assumed that they will immediately take action and view their inbox when they get this many emails.
 */
const MAX_EMAILS_PER_AGENT = 3

/**
 * Sends emails to each agent about their newly-assigned tickets.
 *
 * @param principal_id ID of the helpdesk principal to use while gathering information that is necessary for
 * the emails.
 * @param newAssignments List of reassignments, usually outputted by the `reassignAgentTickets` method.
 */
export async function notifyAboutReassignments(
  principal_id: string,
  newAssignments: TicketReassignment[],
) {
  const principals = await getPrincipals(fdm, [
    ...newAssignments.map((assignment) => assignment.agent_id),
    ...newAssignments
      .map((assignment) => assignment.ticket.requester_id)
      .filter((id) => typeof id === "string"),
  ])

  const sentCounts = new Map<string, number>()

  for (const assignment of newAssignments) {
    // Limit email sending to a maximum number per agent
    if ((sentCounts.get(assignment.agent_id) ?? 0) >= MAX_EMAILS_PER_AGENT) continue

    try {
      const email = principals.get(assignment.agent_id)?.email
      const requester_name =
        (assignment.ticket.requester_id
          ? principals.get(assignment.ticket.requester_id)?.displayUserName
          : undefined) ??
        assignment.ticket.requester_id ??
        "Onbekend"

      if (!email) continue

      const subject = assignment.ticket.subject ?? "Onbekend"
      const messages = await getMessagesForTicket(fdm, principal_id, assignment.ticket.ticket_id, {
        pageLimit: 1,
      })

      await sendHelpdeskNewMessageEmail(
        email,
        assignment.display_name,
        requester_name,
        assignment.ticket.ticket_ref,
        subject,
        assignment.ticket.ticket_id,
        messages.length > 0 ? messages[0].body : subject,
        messages.length > 0 ? messages[0].body : subject,
      )

      sentCounts.set(assignment.agent_id, (sentCounts.get(assignment.agent_id) ?? 0) + 1)
    } catch (err) {
      handleActionError(err)
    }
  }
}
