import {
  checkHelpdeskPermission,
  getAgent,
  reassignAgentTickets,
  setAgentStatus,
  setAssignmentTier,
  setMaxTickets,
  setWorkDays,
  type TicketReassignment,
  updateAgent,
} from "@nmi-agro/fdm-helpdesk"
import { useLoaderData } from "react-router"
import { dataWithSuccess } from "remix-toast"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { AgentForm } from "~/components/blocks/helpdesk/agent-form"
import { UpdateAgentSchema } from "~/components/blocks/helpdesk/agent-schema"
import { notifyAboutReassignments } from "~/components/blocks/helpdesk/reassignment-notification.server"
import { getSession } from "~/lib/auth.server"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { extractFormValuesFromRequest } from "~/lib/form"
import type { Route } from "./+types/support.settings.profile"

// Meta
export const meta: Route.MetaFunction = () => {
  return [
    {
      title: `Mijn profiel - Ondersteuning | ${clientConfig.name}`,
    },
    {
      name: "description",
      content: "Beheer uw informatie als ondersteuningsmedewerker.",
    },
  ]
}

export async function loader({ request }: Route.LoaderArgs) {
  try {
    const session = await getSession(request)

    const agent = await getAgent(fdm, session.principal_id, session.principal_id)

    const helpdeskWritePermission = await checkHelpdeskPermission(
      fdm,
      "helpdesk",
      "write",
      "",
      session.principal_id,
      "routes/support.settings.profile",
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

export async function action({ request }: Route.ActionArgs) {
  try {
    const session = await getSession(request)

    const agentUpdate = await extractFormValuesFromRequest(request, UpdateAgentSchema)

    let newAssignments: TicketReassignment[] = []

    await fdm.transaction(async (tx) => {
      const agent = await getAgent(tx, session.principal_id, session.principal_id)

      await updateAgent(tx, session.principal_id, session.principal_id, agentUpdate.display_name)

      await setAgentStatus(
        tx,
        session.principal_id,
        session.principal_id,
        agentUpdate.availability_status,
      )

      await setWorkDays(tx, session.principal_id, session.principal_id, agentUpdate.work_days)

      await setMaxTickets(
        tx,
        session.principal_id,
        session.principal_id,
        agentUpdate.max_tickets ?? null,
      )

      if (typeof agentUpdate.assignment_tier === "number") {
        const helpdeskWritePermission = await checkHelpdeskPermission(
          fdm,
          "helpdesk",
          "write",
          "",
          session.principal_id,
          "routes/support.settings.profile",
          false,
        )

        if (helpdeskWritePermission) {
          await setAssignmentTier(
            tx,
            session.principal_id,
            session.principal_id,
            agentUpdate.assignment_tier,
          )
        }
      }

      // Only after updating the agent to the latest state, try to reassign their tickets
      if (
        agentUpdate.reassign_tickets &&
        agentUpdate.availability_status !== agent.availability_status &&
        agentUpdate.availability_status === "out-of-office"
      ) {
        const reassignment = await reassignAgentTickets(
          tx,
          session.principal_id,
          session.principal_id,
        )
        newAssignments = reassignment.reassigned
      }
    })

    if (newAssignments.length > 0) {
      try {
        await notifyAboutReassignments(session.principal_id, newAssignments)

        return dataWithSuccess("Gegevens succesvol bijgewerkt en tickets opnieuw toegewezen.", {
          message: "Gegevens succesvol bijgewerkt en tickets opnieuw toegewezen.",
        })
      } catch (err) {
        handleActionError(err)
      }
    }

    // Code will reach here also when notifying the new assignees fails
    return dataWithSuccess("Gegevens succesvol bijgewerkt.", {
      message: "Gegevens succesvol bijgewerkt.",
    })
  } catch (err) {
    throw handleActionError(err)
  }
}

export default function SupportSettingsProfile() {
  const { agent, helpdeskWritePermission } = useLoaderData<typeof loader>()

  return (
    <main className="p-6">
      <FarmTitle
        title="Mijn Info"
        description="Hier kun je jouw informatie als medewerker beheren."
      />
      <AgentForm agent={agent} isAdmin={helpdeskWritePermission} person="second" />
    </main>
  )
}
