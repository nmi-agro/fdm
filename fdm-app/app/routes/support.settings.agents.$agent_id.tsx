import { getPrincipals } from "@nmi-agro/fdm-core"
import { checkHelpdeskPermission, setAssignmentTier } from "@nmi-agro/fdm-helpdesk"
import {
  getAgent,
  getMessagesForTicket,
  reassignAgentTickets,
  setAgentStatus,
  setMaxTickets,
  setWorkDays,
  type TicketReassignment,
  updateAgent,
} from "@nmi-agro/fdm-helpdesk"
import { useLoaderData, useNavigate } from "react-router"
import { redirectWithSuccess } from "remix-toast"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { AgentFormDialog } from "~/components/blocks/helpdesk/agent-form"
import { UpdateAgentSchema } from "~/components/blocks/helpdesk/agent-schema"
import { getSession } from "~/lib/auth.server"
import { sendHelpdeskNewMessageEmail } from "~/lib/email.server"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { extractFormValuesFromRequest } from "~/lib/form"
import type { Route } from "./+types/support.settings.agents.$agent_id"

export async function loader({ params, request }: Route.LoaderArgs) {
  try {
    const session = await getSession(request)

    const agent = await getAgent(fdm, session.principal_id, params.agent_id)

    const helpdeskWritePermission = await checkHelpdeskPermission(
      fdm,
      "helpdesk",
      "write",
      "",
      session.principal_id,
      "routes/support.settings.agents.$agent_id",
      false,
    )

    return {
      agent: agent,
      helpdeskWritePermission: helpdeskWritePermission,
    }
  } catch (err) {
    throw handleLoaderError(err)
  }
}

export async function action({ params, request }: Route.ActionArgs) {
  try {
    console.log("Action called for agent:", params.agent_id)
    const session = await getSession(request)

    const agentUpdate = await extractFormValuesFromRequest(request, UpdateAgentSchema)

    let newAssignments: TicketReassignment[] = []

    await fdm.transaction(async (tx) => {
      const agent = await getAgent(tx, session.principal_id, params.agent_id)

      if (
        agentUpdate.reassign_tickets &&
        agentUpdate.availability_status !== agent.availability_status &&
        agentUpdate.availability_status === "out-of-office"
      ) {
        const reassignment = await reassignAgentTickets(tx, params.agent_id, session.principal_id)
        newAssignments = reassignment.reassigned
      }

      await updateAgent(tx, session.principal_id, params.agent_id, agentUpdate.display_name)

      await setAgentStatus(
        tx,
        session.principal_id,
        params.agent_id,
        agentUpdate.availability_status,
      )

      await setWorkDays(tx, session.principal_id, params.agent_id, agentUpdate.work_days)

      await setMaxTickets(
        tx,
        session.principal_id,
        params.agent_id,
        agentUpdate.max_tickets ?? null,
      )

      if (typeof agentUpdate.assignment_tier === "number") {
        await setAssignmentTier(
          tx,
          session.principal_id,
          params.agent_id,
          agentUpdate.assignment_tier,
        )
      }
    })

    if (newAssignments.length > 0) {
      const principals = await getPrincipals(fdm, [
        ...newAssignments.map((assignment) => assignment.agent_id),
        ...newAssignments
          .map((assignment) => assignment.ticket.requester_id)
          .filter((id) => typeof id === "string"),
      ])

      const sentCounts = new Map<string, number>()

      for (const assignment of newAssignments) {
        // Limit email sending to a maximum number per agent
        if ((sentCounts.get(assignment.agent_id) ?? 0) >= 3) continue

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
          const messages = await getMessagesForTicket(
            fdm,
            session.principal_id,
            assignment.ticket.ticket_id,
            { pageLimit: 1 },
          )

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

      return redirectWithSuccess("/support/settings/agents", {
        message: "Gegevens succesvol bijgewerkt en tickets opnieuw toegewezen.",
      })
    }
    return redirectWithSuccess("/support/settings/agents", {
      message: "Gegevens succesvol bijgewerkt.",
    })
  } catch (err) {
    throw handleActionError(err)
  }
}

export default function SupportSettingsProfile() {
  const { agent, helpdeskWritePermission } = useLoaderData<typeof loader>()
  const navigate = useNavigate()

  return (
    <main className="p-6">
      <FarmTitle
        title="Mijn Info"
        description="Hier kun je jouw informatie als medewerker beheren."
      />
      <AgentFormDialog
        agent={agent}
        isAdmin={helpdeskWritePermission}
        open={true}
        onOpenChange={(open) => {
          if (!open) navigate("..")
        }}
      />
    </main>
  )
}
