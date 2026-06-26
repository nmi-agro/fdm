import {
    getAgent,
    setAgentStatus,
    setMaxTickets,
    setWorkDays,
    updateAgent,
} from "@nmi-agro/fdm-helpdesk"
import { useLoaderData } from "react-router"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { AgentForm } from "~/components/blocks/helpdesk/agent-form"
import { UpdateAgentSchema } from "~/components/blocks/helpdesk/agent-schema"
import { getSession } from "~/lib/auth.server"
import { clientConfig } from "~/lib/config"
import { handleLoaderError } from "~/lib/error"
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

        const agent = await getAgent(
            fdm,
            session.principal_id,
            session.principal_id,
        )

        return {
            agent: agent,
        }
    } catch (err) {
        throw handleLoaderError(err)
    }
}

export async function action({ request }: Route.ActionArgs) {
    try {
        const session = await getSession(request)

        const agentUpdate = await extractFormValuesFromRequest(
            request,
            UpdateAgentSchema,
        )

        await fdm.transaction(async (tx) => {
            await updateAgent(
                tx,
                session.principal_id,
                session.principal_id,
                agentUpdate.display_name,
            )

            await setAgentStatus(
                tx,
                session.principal_id,
                session.principal_id,
                agentUpdate.availability_status,
            )

            await setWorkDays(
                tx,
                session.principal_id,
                session.principal_id,
                agentUpdate.work_days,
            )

            await setMaxTickets(
                tx,
                session.principal_id,
                session.principal_id,
                agentUpdate.max_tickets ?? null,
            )
        })
    } catch (err) {
        throw handleLoaderError(err)
    }
}

export default function SupportSettingsProfile() {
    const { agent } = useLoaderData<typeof loader>()

    return (
        <main className="p-6">
            <FarmTitle
                title="Mijn Info"
                description="Hier kun je jouw informatie als medewerker beheren."
            />
            <AgentForm agent={agent} />
        </main>
    )
}
