import { type FdmType, handleError } from "@nmi-agro/fdm-core"
import { checkHelpdeskPermission } from "./authorization"
import * as schema from "./db/schema-helpdesk"
import { createId } from "./id"

export async function addMessage(
    fdm: FdmType,
    ticket_id: string,
    sender_id: string,
    sender_type: "customer" | "agent",
    body: string,
    is_internal?: boolean,
) {
    try {
        await checkHelpdeskPermission(
            fdm,
            "ticket-user-side",
            "write",
            ticket_id,
            sender_id,
            "addMessage",
        )

        const message_id = createId()
        await fdm.insert(schema.messages).values([
            {
                ticket_id: ticket_id,
                message_id: message_id,
                sender_id: sender_id,
                body: body,
                sender_type: sender_type,
                is_internal: is_internal,
            },
        ])
    } catch (err) {
        throw handleError(err, "Exception for addMessage", {
            ticket_id,
            sender_id,
        })
    }
}
