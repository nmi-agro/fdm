import { type FdmType, handleError, type PrincipalId } from "@nmi-agro/fdm-core"
import { checkHelpdeskPermission } from "./authorization"
import * as schema from "./db/schema-helpdesk"

export type AgentSummary = {
    agent_id: schema.AgentTypeSelect["agent_id"]
    principal_id: schema.AgentTypeSelect["principal_id"]
    display_name: schema.AgentTypeSelect["display_name"]
}

export type Agent = schema.AgentTypeSelect

export async function addAgent(
    fdm: FdmType,
    principal_id: PrincipalId,
    agent_id: schema.AgentTypeInsert["agent_id"],
    display_name: schema.AgentTypeInsert["display_name"],
    is_active: schema.AgentTypeInsert["is_active"] = true,
) {
    await checkHelpdeskPermission(
        fdm,
        "helpdesk",
        "write",
        "",
        principal_id,
        "addAgent",
    )
    try {
        await fdm.insert(schema.agents).values([
            {
                agent_id: agent_id,
                principal_id: agent_id,
                display_name: display_name,
                is_active: is_active,
            },
        ])
    } catch (err) {
        throw handleError(err, "Error in addAgent")
    }
}
