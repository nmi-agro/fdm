import { getPrincipal, getPrincipals } from "@nmi-agro/fdm-core"
import {
  addAgent,
  checkHelpdeskPermission,
  getAbsencesForAgentsOnDate,
  getAgent,
  getAgents,
  reassignAgentTickets,
  setAgentActiveStatus,
  TicketReassignment,
  updateAgentRole,
} from "@nmi-agro/fdm-helpdesk"
import { Outlet, useLoaderData } from "react-router"
import { dataWithSuccess } from "remix-toast"
import z from "zod"
import { makeHelpdeskUser } from "@/app/components/blocks/helpdesk/helpdesk-user"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import {
  agentRoles,
  HelpdeskAgentManager,
  type HelpdeskUserExtended,
} from "~/components/blocks/helpdesk/agent-manager"
import {
  AddAgentSchema,
  SetAgentActiveStatusSchema,
  UpdateAgentRoleSchema,
} from "~/components/blocks/helpdesk/agent-schema"
import { notifyAboutReassignments } from "~/components/blocks/helpdesk/reassignment-notification.server"
import { getSession } from "~/lib/auth.server"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { extractFormValuesFromRequest } from "~/lib/form"
import type { Route } from "./+types/support.settings.agents"

// Meta
export const meta: Route.MetaFunction = () => {
  return [
    {
      title: `Medewerkers - Ondersteuning | ${clientConfig.name}`,
    },
    {
      name: "description",
      content: "Bekijk de medewerkers die toegang hebben tot het ondersteuningsdashboard.",
    },
  ]
}

export async function loader({ request }: Route.LoaderArgs) {
  try {
    const session = await getSession(request)

    const agents = await getAgents(fdm, session.principal_id)

    const principals = await getPrincipals(
      fdm,
      agents.map((agent) => agent.agent_id),
    )

    const helpdeskWritePermission = await checkHelpdeskPermission(
      fdm,
      "helpdesk",
      "write",
      "",
      session.principal_id,
      "routes/admin.support.settings.agents",
      false,
    )

    const agentAbsences = await getAbsencesForAgentsOnDate(fdm, session.principal_id, new Date())

    const helpdeskUsers: HelpdeskUserExtended[] = agents.map((agent) => {
      return {
        ...makeHelpdeskUser(agent, principals),
        absence: agentAbsences.get(agent.agent_id) ?? null,
        availability_status: agent.availability_status,
        assignment_tier: agent.assignment_tier,
        role: agent.role,
        isActive: agent.is_active,
        isInvitation: false,
      }
    })

    return {
      helpdeskUsers: helpdeskUsers,
      helpdeskWritePermission: helpdeskWritePermission,
    }
  } catch (err) {
    throw handleLoaderError(err)
  }
}

const ActionSchema = z.discriminatedUnion("intent", [
  AddAgentSchema.extend({ intent: z.literal("add_agent") }),
  UpdateAgentRoleSchema.extend({ intent: z.literal("update_agent_role") }),
  SetAgentActiveStatusSchema.extend({
    intent: z.literal("set_agent_active_status"),
  }),
])

export async function action({ request }: Route.ActionArgs) {
  try {
    const session = await getSession(request)

    const formValues = await extractFormValuesFromRequest(request, ActionSchema)

    if (formValues.intent === "add_agent") {
      const principal = await getPrincipal(fdm, formValues.principal_id)
      await addAgent(
        fdm,
        session.principal_id,
        formValues.principal_id,
        principal?.displayUserName ?? "Onbekende Medewerker",
      )
      await updateAgentRole(fdm, session.principal_id, formValues.principal_id, formValues.role)
    }

    if (formValues.intent === "update_agent_role") {
      await updateAgentRole(fdm, session.principal_id, formValues.principal_id, formValues.role)
    }

    if (formValues.intent === "set_agent_active_status") {
      let newAssignments: TicketReassignment[] = []
      await fdm.transaction(async (tx) => {
        const agent = await getAgent(tx, session.principal_id, formValues.principal_id)

        if (agent.is_active !== formValues.is_active) {
          await setAgentActiveStatus(
            tx,
            session.principal_id,
            formValues.principal_id,
            Boolean(formValues.is_active),
          )
        }

        if (agent.is_active && !formValues.is_active) {
          const reassignment = await reassignAgentTickets(
            tx,
            formValues.principal_id,
            session.principal_id,
          )
          newAssignments = reassignment.reassigned
        }
      })

      if (newAssignments.length > 0) {
        try {
          await notifyAboutReassignments(session.principal_id, newAssignments)

          return dataWithSuccess(
            "De medewerker is gedeactiveerd en de tickets zijn opnieuw toegewezen.",
            {
              message: "De medewerker is gedeactiveerd en de tickets zijn opnieuw toegewezen.",
            },
          )
        } catch (err) {
          handleActionError(err)
        }
      }

      // Code will reach here also when notifying the new assignees fails
      return dataWithSuccess(
        { is_active: formValues.is_active },
        {
          message: formValues.is_active
            ? "De medewerker is geactiveerd."
            : "De medewerker is gedeactiveerd.",
        },
      )
    }
  } catch (err) {
    throw handleActionError(err)
  }
}

export default function HelpdeskAgentSettings() {
  const { helpdeskUsers, helpdeskWritePermission } = useLoaderData<typeof loader>()

  return (
    <main className="p-6">
      <FarmTitle
        title="Medewerkers"
        description={
          helpdeskWritePermission
            ? "Beheer de medewerkers die toegang hebben tot het ondersteuningsdashboard. Medewerkers kunnen tickets bekijken en beantwoorden; beheerders kunnen ook medewerkers toevoegen en deactiveren."
            : "Bekijk de medewerkers die toegang hebben tot het ondersteuningsdashboard."
        }
      />
      <HelpdeskAgentManager
        helpdeskUsers={helpdeskUsers}
        roles={agentRoles}
        canModify={helpdeskWritePermission}
      />
      <Outlet />
    </main>
  )
}
