import { checkHelpdeskPermission, setAssignmentTier } from "@nmi-agro/fdm-helpdesk"
import {
  getAgent,
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
import { notifyAboutReassignments } from "~/components/blocks/helpdesk/reassignment-notification.server"
import { getSession } from "~/lib/auth.server"
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
    const session = await getSession(request)

    const agentUpdate = await extractFormValuesFromRequest(request, UpdateAgentSchema)

    let newAssignments: TicketReassignment[] = []

    await fdm.transaction(async (tx) => {
      // Only admins can post to this route
      await checkHelpdeskPermission(
        fdm,
        "helpdesk",
        "write",
        "",
        session.principal_id,
        "routes/support.settings.agents.$agent_id",
      )

      const agent = await getAgent(tx, session.principal_id, params.agent_id)

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

      // Only after updating the agent to the latest state, try to reassign their tickets
      if (
        agentUpdate.reassign_tickets &&
        agentUpdate.availability_status !== agent.availability_status &&
        agentUpdate.availability_status === "out-of-office"
      ) {
        const reassignment = await reassignAgentTickets(tx, params.agent_id, session.principal_id)
        newAssignments = reassignment.reassigned
      }
    })

    if (newAssignments.length > 0) {
      await notifyAboutReassignments(session.principal_id, newAssignments)

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
        person="third"
        open={true}
        onOpenChange={(open) => {
          if (!open) navigate("..")
        }}
      />
    </main>
  )
}
