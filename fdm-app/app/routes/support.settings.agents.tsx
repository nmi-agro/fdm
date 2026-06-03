import { getPrincipal, getPrincipals } from "@nmi-agro/fdm-core"
import {
    addAgent,
    checkHelpdeskPermission,
    getAgents,
    setAgentActiveStatus,
    updateAgentRole,
} from "@nmi-agro/fdm-helpdesk"
import { useLoaderData } from "react-router"
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
import { getSession } from "~/lib/auth.server"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { extractFormValuesFromRequest } from "~/lib/form"
import type { Route } from "./+types/support.settings.agents"

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

        const helpdeskUsers: HelpdeskUserExtended[] = agents.map((agent) => {
            return {
                ...makeHelpdeskUser(agent, principals),
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

        const formValues = await extractFormValuesFromRequest(
            request,
            ActionSchema,
        )

        if (formValues.intent === "add_agent") {
            const principal = await getPrincipal(fdm, formValues.principal_id)
            await addAgent(
                fdm,
                session.principal_id,
                formValues.principal_id,
                principal?.displayUserName ?? "Onbekende Medewerker",
            )
            await updateAgentRole(
                fdm,
                session.principal_id,
                formValues.principal_id,
                formValues.role,
            )
        }

        if (formValues.intent === "update_agent_role") {
            await updateAgentRole(
                fdm,
                session.principal_id,
                formValues.principal_id,
                formValues.role,
            )
        }

        if (formValues.intent === "set_agent_active_status") {
            await setAgentActiveStatus(
                fdm,
                session.principal_id,
                formValues.principal_id,
                Boolean(formValues.is_active),
            )
        }
    } catch (err) {
        throw handleActionError(err)
    }
}

export default function HelpdeskAgentSettings() {
    const { helpdeskUsers, helpdeskWritePermission } =
        useLoaderData<typeof loader>()

    return (
        <main className="p-6">
            <FarmTitle
                title="Medewerkers"
                description={
                    helpdeskWritePermission
                        ? "Bekijk en beheer de gebruikers die toegang naar de ondersteuningsdashboard hebben."
                        : "Bekijk de gebruikers die toegang naar de ondersteuningsdashboard hebben."
                }
            />
            <HelpdeskAgentManager
                helpdeskUsers={helpdeskUsers}
                roles={agentRoles}
                canModify={helpdeskWritePermission}
            />
        </main>
    )
}
