import { eq } from "drizzle-orm"
import { describe, expect } from "vitest"
import { addAdminAgent, addAgent } from "./agent"
import {
    checkHelpdeskPermission,
    getHelpdeskPermission,
    getHelpdeskRole,
} from "./authorization"
import * as schema from "./db/schema-helpdesk"
import { createId } from "./id"
import { addMessage } from "./message"
import { test } from "./test-util"
import { createTicket } from "./ticket"

describe("getHelpdeskRole", () => {
    let admin_id: string
    let agent_id: string

    test.beforeEach(async ({ fdm }) => {
        admin_id = createId()
        await addAdminAgent(fdm, admin_id, "Admin Agent")

        agent_id = createId()
        await addAgent(fdm, admin_id, agent_id, "Regular Agent")
    })

    test("returns 'user' for an unknown principal", async ({ fdm }) => {
        const role = await getHelpdeskRole(fdm, createId())
        expect(role).toBe("user")
    })

    test("returns 'agent' for a regular agent", async ({ fdm }) => {
        const role = await getHelpdeskRole(fdm, agent_id)
        expect(role).toBe("agent")
    })

    test("returns 'admin' for an admin", async ({ fdm }) => {
        const role = await getHelpdeskRole(fdm, admin_id)
        expect(role).toBe("admin")
    })

    test("returns 'user' for an array containing an unknown ID", async ({
        fdm,
    }) => {
        const role = await getHelpdeskRole(fdm, [agent_id, createId()])
        expect(role).toBe("user")
    })

    test("returns 'agent' for an array of all agents", async ({ fdm }) => {
        const second_agent_id = createId()
        await addAgent(fdm, admin_id, second_agent_id, "Second Agent")
        const role = await getHelpdeskRole(fdm, [agent_id, second_agent_id])
        expect(role).toBe("agent")
    })

    test("returns 'admin' for an array of all admins", async ({ fdm }) => {
        const second_admin_id = createId()
        await addAdminAgent(fdm, second_admin_id, "Second Admin")
        const role = await getHelpdeskRole(fdm, [admin_id, second_admin_id])
        expect(role).toBe("admin")
    })

    test("returns 'user' for an array mixing agent and admin", async ({
        fdm,
    }) => {
        // Neither all-admin nor all-agent → falls through to 'user'
        const role = await getHelpdeskRole(fdm, [agent_id, admin_id])
        expect(role).toBe("user")
    })
})

describe("checkHelpdeskPermission", () => {
    let admin_id: string
    let user_id: string

    test.beforeEach(async ({ fdm }) => {
        admin_id = createId()
        await addAdminAgent(fdm, admin_id, "Admin Agent")
        user_id = createId()
    })

    test("returns true when the principal has permission", async ({ fdm }) => {
        const result = await checkHelpdeskPermission(
            fdm,
            "helpdesk",
            "read",
            "",
            admin_id,
            "test",
        )
        expect(result).toBe(true)
    })

    test("throws when strict=true and permission is denied", async ({
        fdm,
    }) => {
        await expect(
            checkHelpdeskPermission(
                fdm,
                "helpdesk",
                "write",
                "",
                user_id,
                "test",
                true,
            ),
        ).rejects.toThrow(
            "Principal does not have permission to perform this action",
        )
    })

    test("returns false (no throw) when strict=false and permission is denied", async ({
        fdm,
    }) => {
        const result = await checkHelpdeskPermission(
            fdm,
            "helpdesk",
            "write",
            "",
            user_id,
            "test",
            false,
        )
        expect(result).toBe(false)
    })
})

describe("getHelpdeskPermission — helpdesk resource", () => {
    let admin_id: string
    let agent_id: string
    let user_id: string

    test.beforeEach(async ({ fdm }) => {
        admin_id = createId()
        await addAdminAgent(fdm, admin_id, "Admin Agent")

        agent_id = createId()
        await addAgent(fdm, admin_id, agent_id, "Regular Agent")

        user_id = createId()
    })

    test("admin can write helpdesk", async ({ fdm }) => {
        const result = await getHelpdeskPermission(
            fdm,
            "helpdesk",
            "write",
            "",
            admin_id,
        )
        expect(result).not.toBeNull()
        expect(result?.granting_resource).toBe("helpdesk")
    })

    test("agent can read helpdesk", async ({ fdm }) => {
        const result = await getHelpdeskPermission(
            fdm,
            "helpdesk",
            "read",
            "",
            agent_id,
        )
        expect(result).not.toBeNull()
        expect(result?.granting_resource).toBe("helpdesk")
    })

    test("agent cannot write helpdesk", async ({ fdm }) => {
        const result = await getHelpdeskPermission(
            fdm,
            "helpdesk",
            "write",
            "",
            agent_id,
        )
        expect(result).toBeNull()
    })

    test("regular user cannot read helpdesk", async ({ fdm }) => {
        const result = await getHelpdeskPermission(
            fdm,
            "helpdesk",
            "read",
            "",
            user_id,
        )
        expect(result).toBeNull()
    })

    test("regular user cannot write helpdesk", async ({ fdm }) => {
        const result = await getHelpdeskPermission(
            fdm,
            "helpdesk",
            "write",
            "",
            user_id,
        )
        expect(result).toBeNull()
    })
})

describe("getHelpdeskPermission — agent resource", () => {
    let admin_id: string
    let agent_id: string
    let other_agent_id: string

    test.beforeEach(async ({ fdm }) => {
        admin_id = createId()
        await addAdminAgent(fdm, admin_id, "Admin Agent")

        agent_id = createId()
        await addAgent(fdm, admin_id, agent_id, "Regular Agent")

        other_agent_id = createId()
        await addAgent(fdm, admin_id, other_agent_id, "Other Agent")
    })

    test("admin can read any agent", async ({ fdm }) => {
        const result = await getHelpdeskPermission(
            fdm,
            "agent",
            "read",
            agent_id,
            admin_id,
        )
        expect(result).not.toBeNull()
        expect(result?.granting_resource).toBe("agent")
    })

    test("admin can write any agent", async ({ fdm }) => {
        const result = await getHelpdeskPermission(
            fdm,
            "agent",
            "write",
            agent_id,
            admin_id,
        )
        expect(result).not.toBeNull()
        expect(result?.granting_resource).toBe("agent")
    })

    test("agent can read themselves", async ({ fdm }) => {
        const result = await getHelpdeskPermission(
            fdm,
            "agent",
            "read",
            agent_id,
            agent_id,
        )
        expect(result).not.toBeNull()
        expect(result?.granting_resource).toBe("agent")
    })

    test("agent can write themselves", async ({ fdm }) => {
        const result = await getHelpdeskPermission(
            fdm,
            "agent",
            "write",
            agent_id,
            agent_id,
        )
        expect(result).not.toBeNull()
        expect(result?.granting_resource).toBe("agent")
    })

    test("agent cannot write another agent", async ({ fdm }) => {
        const result = await getHelpdeskPermission(
            fdm,
            "agent",
            "write",
            other_agent_id,
            agent_id,
        )
        expect(result).toBeNull()
    })

    test("returns null for a nonexistent agent resource_id", async ({
        fdm,
    }) => {
        const result = await getHelpdeskPermission(
            fdm,
            "agent",
            "read",
            createId(),
            admin_id,
        )
        expect(result).toBeNull()
    })
})

describe("getHelpdeskPermission — ticket-user-side resource", () => {
    let admin_id: string
    let requester_id: string
    let other_user_id: string
    let ticket_id: string

    test.beforeEach(async ({ fdm }) => {
        admin_id = createId()
        await addAdminAgent(fdm, admin_id, "Admin Agent")

        requester_id = createId()
        other_user_id = createId()

        ticket_id = await createTicket(fdm, requester_id, "Test ticket")
    })

    test("requester can read their own ticket", async ({ fdm }) => {
        const result = await getHelpdeskPermission(
            fdm,
            "ticket-user-side",
            "read",
            ticket_id,
            requester_id,
        )
        expect(result).not.toBeNull()
        expect(result?.granting_resource).toBe("ticket-user-side")
    })

    test("unrelated user cannot read someone else's ticket", async ({
        fdm,
    }) => {
        const result = await getHelpdeskPermission(
            fdm,
            "ticket-user-side",
            "read",
            ticket_id,
            other_user_id,
        )
        expect(result).toBeNull()
    })

    test("active agent can read any ticket", async ({ fdm }) => {
        const result = await getHelpdeskPermission(
            fdm,
            "ticket-user-side",
            "read",
            ticket_id,
            admin_id,
        )
        expect(result).not.toBeNull()
    })
})

describe("getHelpdeskPermission — ticket-agent-side resource", () => {
    let admin_id: string
    let agent_id: string
    let inactive_agent_id: string
    let requester_id: string
    let ticket_id: string

    test.beforeEach(async ({ fdm }) => {
        admin_id = createId()
        await addAdminAgent(fdm, admin_id, "Admin Agent")

        agent_id = createId()
        await addAgent(fdm, admin_id, agent_id, "Regular Agent")

        inactive_agent_id = createId()
        await addAgent(fdm, admin_id, inactive_agent_id, "Inactive Agent")
        await fdm
            .update(schema.agents)
            .set({ is_active: false })
            .where(eq(schema.agents.agent_id, inactive_agent_id))

        requester_id = createId()
        ticket_id = await createTicket(fdm, requester_id, "Test ticket")
    })

    test("active agent can read ticket-agent-side", async ({ fdm }) => {
        const result = await getHelpdeskPermission(
            fdm,
            "ticket-agent-side",
            "read",
            ticket_id,
            agent_id,
        )
        expect(result).not.toBeNull()
        expect(result?.granting_resource).toBe("ticket-agent-side")
    })

    test("active agent can write ticket-agent-side", async ({ fdm }) => {
        const result = await getHelpdeskPermission(
            fdm,
            "ticket-agent-side",
            "write",
            ticket_id,
            agent_id,
        )
        expect(result).not.toBeNull()
        expect(result?.granting_resource).toBe("ticket-agent-side")
    })

    test("inactive agent cannot write ticket-agent-side", async ({ fdm }) => {
        const result = await getHelpdeskPermission(
            fdm,
            "ticket-agent-side",
            "write",
            ticket_id,
            inactive_agent_id,
        )
        expect(result).toBeNull()
    })

    test("regular user cannot write ticket-agent-side", async ({ fdm }) => {
        const result = await getHelpdeskPermission(
            fdm,
            "ticket-agent-side",
            "write",
            ticket_id,
            requester_id,
        )
        expect(result).toBeNull()
    })

    test("requester can read their own ticket-agent-side", async ({ fdm }) => {
        const result = await getHelpdeskPermission(
            fdm,
            "ticket-agent-side",
            "read",
            ticket_id,
            requester_id,
        )
        expect(result).not.toBeNull()
    })
})

describe("getHelpdeskPermission — message resource", () => {
    let admin_id: string
    let requester_id: string
    let other_user_id: string
    let ticket_id: string
    let public_message_id: string
    let internal_message_id: string

    test.beforeEach(async ({ fdm }) => {
        admin_id = createId()
        await addAdminAgent(fdm, admin_id, "Admin Agent")

        requester_id = createId()
        other_user_id = createId()

        ticket_id = await createTicket(fdm, requester_id, "Test ticket")

        public_message_id = await addMessage(
            fdm,
            ticket_id,
            requester_id,
            "customer",
            "Public message",
            false,
        )

        internal_message_id = await addMessage(
            fdm,
            ticket_id,
            admin_id,
            "agent",
            "Internal note",
            true,
        )
    })

    test("requester can read a non-internal message on their ticket", async ({
        fdm,
    }) => {
        const result = await getHelpdeskPermission(
            fdm,
            "message",
            "read",
            public_message_id,
            requester_id,
        )
        expect(result).not.toBeNull()
        expect(result?.granting_resource).toBe("message")
    })

    test("requester cannot read an internal message on their ticket", async ({
        fdm,
    }) => {
        const result = await getHelpdeskPermission(
            fdm,
            "message",
            "read",
            internal_message_id,
            requester_id,
        )
        expect(result).toBeNull()
    })

    test("admin can read any message including internal", async ({ fdm }) => {
        const result = await getHelpdeskPermission(
            fdm,
            "message",
            "read",
            internal_message_id,
            admin_id,
        )
        expect(result).not.toBeNull()
    })

    test("requester can write their own message", async ({ fdm }) => {
        const result = await getHelpdeskPermission(
            fdm,
            "message",
            "write",
            public_message_id,
            requester_id,
        )
        expect(result).not.toBeNull()
    })

    test("admin can write any message", async ({ fdm }) => {
        const result = await getHelpdeskPermission(
            fdm,
            "message",
            "write",
            public_message_id,
            admin_id,
        )
        expect(result).not.toBeNull()
    })

    test("unrelated user cannot write a message they did not send", async ({
        fdm,
    }) => {
        const result = await getHelpdeskPermission(
            fdm,
            "message",
            "write",
            public_message_id,
            other_user_id,
        )
        expect(result).toBeNull()
    })
})
