import { type FdmType, handleError, type PrincipalId } from "@nmi-agro/fdm-core"
import { eq, sql } from "drizzle-orm"
import { checkHelpdeskPermission } from "./authorization"
import * as schema from "./db/schema-helpdesk"

export type AgentSummary = {
    agent_id: schema.AgentTypeSelect["agent_id"]
    principal_id: schema.AgentTypeSelect["principal_id"]
    display_name: schema.AgentTypeSelect["display_name"]
}

export type Agent = schema.AgentTypeSelect

export async function getAgent(
    fdm: FdmType,
    principal_id: PrincipalId,
    agent_id: schema.AgentTypeSelect["agent_id"],
) {
    try {
        await checkHelpdeskPermission(
            fdm,
            "agent",
            "read",
            agent_id,
            principal_id,
            "getAgent",
        )

        const found = await fdm
            .select()
            .from(schema.agents)
            .where(eq(schema.agents.agent_id, agent_id))

        return found[0]
    } catch (err) {
        throw handleError(err, "Exception for getAgent", {
            principal_id,
            agent_id,
        })
    }
}

export async function getAgents(fdm: FdmType, principal_id: PrincipalId) {
    try {
        await checkHelpdeskPermission(
            fdm,
            "helpdesk",
            "read",
            "",
            principal_id,
            "getAgents",
        )

        return await fdm.select().from(schema.agents)
    } catch (err) {
        throw handleError(err, "Exception for getAgents", {
            principal_id,
        })
    }
}

export async function addAgent(
    fdm: FdmType,
    principal_id: PrincipalId,
    agent_id: schema.AgentTypeInsert["agent_id"],
    display_name: schema.AgentTypeInsert["display_name"],
): Promise<schema.AgentTypeSelect["agent_id"]> {
    try {
        await checkHelpdeskPermission(
            fdm,
            "helpdesk",
            "write",
            "",
            principal_id,
            "addAgent",
        )

        await fdm
            .insert(schema.agents)
            .values([
                {
                    agent_id: agent_id,
                    principal_id: agent_id,
                    display_name: display_name,
                },
            ])
            .onConflictDoUpdate({
                target: schema.agents.agent_id,
                set: {
                    display_name: display_name,
                    updated: sql`now()`,
                },
            })

        return agent_id
    } catch (err) {
        throw handleError(err, "Error in addAgent")
    }
}

export async function updateAgent(
    fdm: FdmType,
    principal_id: PrincipalId,
    agent_id: schema.AgentTypeInsert["agent_id"],
    display_name: schema.AgentTypeInsert["display_name"] | undefined,
) {
    try {
        await checkHelpdeskPermission(
            fdm,
            "helpdesk",
            "write",
            "",
            principal_id,
            "addAgent",
        )
        await fdm
            .update(schema.agents)
            .set({
                display_name: display_name,
                updated: sql`now()`,
            })
            .where(eq(schema.agents.agent_id, agent_id))
    } catch (err) {
        throw handleError(err, "Error in updateAgent")
    }
}

export async function setAgentActiveStatus(
    fdm: FdmType,
    principal_id: PrincipalId,
    agent_id: schema.AgentTypeInsert["agent_id"],
    is_active: schema.AgentTypeInsert["is_active"],
) {
    try {
        await checkHelpdeskPermission(
            fdm,
            "helpdesk",
            "write",
            "",
            principal_id,
            "addAgent",
        )

        await fdm
            .update(schema.agents)
            .set({
                is_active: is_active,
            })
            .where(eq(schema.agents.agent_id, agent_id))

        return agent_id
    } catch (err) {
        throw handleError(err, "Error in addAgent")
    }
}
