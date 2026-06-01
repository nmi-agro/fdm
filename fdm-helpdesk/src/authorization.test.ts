import { describe, expect } from "vitest"
import { addAdminAgent, addAgent, setAgentActiveStatus } from "./agent"
import {
    checkHelpdeskPermission,
    getHelpdeskPermission,
    getHelpdeskRole,
} from "./authorization"
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

    test("should return 'user' for an unknown principal", async ({ fdm }) => {
        const role = await getHelpdeskRole(fdm, createId())
        expect(role).toBe("user")
    })

    test("should return 'agent' for a regular agent", async ({ fdm }) => {
        const role = await getHelpdeskRole(fdm, agent_id)
        expect(role).toBe("agent")
    })

    test("should return 'admin' for an admin", async ({ fdm }) => {
        const role = await getHelpdeskRole(fdm, admin_id)
        expect(role).toBe("admin")
    })

    test("should return 'user' for an array containing an unknown ID", async ({
        fdm,
    }) => {
        const role = await getHelpdeskRole(fdm, [agent_id, createId()])
        expect(role).toBe("user")
    })

    test("should return 'agent' for an array of all agents", async ({
        fdm,
    }) => {
        const second_agent_id = createId()
        await addAgent(fdm, admin_id, second_agent_id, "Second Agent")
        const role = await getHelpdeskRole(fdm, [agent_id, second_agent_id])
        expect(role).toBe("agent")
    })

    test("should return 'admin' for an array of all admins", async ({
        fdm,
    }) => {
        const second_admin_id = createId()
        await addAdminAgent(fdm, second_admin_id, "Second Admin")
        const role = await getHelpdeskRole(fdm, [admin_id, second_admin_id])
        expect(role).toBe("admin")
    })

    test("should return 'agent' for an array mixing agent and admin", async ({
        fdm,
    }) => {
        // Not all users are considered admins, but all users are agents
        const role = await getHelpdeskRole(fdm, [agent_id, admin_id])
        expect(role).toBe("agent")
    })

    test("should return 'user' for an array mixing agent and unknown users", async ({
        fdm,
    }) => {
        // Not all users are considered admins, but all users are agents
        const role = await getHelpdeskRole(fdm, [agent_id, createId()])
        expect(role).toBe("user")
    })

    test("should return 'user' for an array mixing admin and unknown users", async ({
        fdm,
    }) => {
        // Not all users are considered admins, but all users are agents
        const role = await getHelpdeskRole(fdm, [admin_id, createId()])
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

    test("should return true when the principal has permission", async ({
        fdm,
    }) => {
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

    test("should throw when strict=true and permission is denied", async ({
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

    test("should return false (no throw) when strict=false and permission is denied", async ({
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

    test("should let admins manage the helpdesk", async ({ fdm }) => {
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

    test("should let regular agents access info about the helpdesk", async ({
        fdm,
    }) => {
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

    test("should not let regular agents manage the helpdesk", async ({
        fdm,
    }) => {
        const result = await getHelpdeskPermission(
            fdm,
            "helpdesk",
            "write",
            "",
            agent_id,
        )
        expect(result).toBeNull()
    })

    test("should not let a regular user view the helpdesk", async ({ fdm }) => {
        const result = await getHelpdeskPermission(
            fdm,
            "helpdesk",
            "read",
            "",
            user_id,
        )
        expect(result).toBeNull()
    })

    test("should not let a regular user modify the helpdesk", async ({
        fdm,
    }) => {
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

    test("should let admin read any agent", async ({ fdm }) => {
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

    test("should let admin write any agent", async ({ fdm }) => {
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

    test("should let regular agents view themselves", async ({ fdm }) => {
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

    test("should let regular agents modify themselves", async ({ fdm }) => {
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

    test("should not let regular agents modify each other", async ({ fdm }) => {
        const result = await getHelpdeskPermission(
            fdm,
            "agent",
            "write",
            other_agent_id,
            agent_id,
        )
        expect(result).toBeNull()
    })

    test("should not grant access for a nonexistent agent resource_id", async ({
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

    test("should let an inactive agent read their own data", async ({
        fdm,
    }) => {
        await setAgentActiveStatus(fdm, admin_id, agent_id, false)

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
})

describe("getHelpdeskPermission — saved reply resource", () => {
    let admin_id: string

    test.beforeEach(async ({ fdm }) => {
        admin_id = createId()
        await addAdminAgent(fdm, admin_id, "Admin Agent")
    })

    test("should not let regular users view a saved reply", async ({ fdm }) => {
        const principal_id = createId()
        const saved_reply_id = createId()
        expect(
            await getHelpdeskPermission(
                fdm,
                "saved_reply",
                "read",
                saved_reply_id,
                principal_id,
            ),
        ).toBeNull()
    })

    test("should not let agents read a nonexistent saved reply", async ({
        fdm,
    }) => {
        const saved_reply_id = createId()
        expect(
            await getHelpdeskPermission(
                fdm,
                "saved_reply",
                "read",
                saved_reply_id,
                admin_id,
            ),
        ).toBeNull()
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

    test("should let requester read their own ticket", async ({ fdm }) => {
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

    test("should not let unrelated user read someone else's ticket", async ({
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

    test("should let active agent read any ticket", async ({ fdm }) => {
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
        await setAgentActiveStatus(fdm, admin_id, inactive_agent_id, false)

        requester_id = createId()
        ticket_id = await createTicket(fdm, requester_id, "Test ticket")
    })

    test("should let active agent read ticket-agent-side", async ({ fdm }) => {
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

    test("should let active agent write ticket-agent-side", async ({ fdm }) => {
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

    test("should not let inactive agent write ticket-agent-side", async ({
        fdm,
    }) => {
        const result = await getHelpdeskPermission(
            fdm,
            "ticket-agent-side",
            "write",
            ticket_id,
            inactive_agent_id,
        )
        expect(result).toBeNull()
    })

    test("should not let requester write ticket-agent-side", async ({
        fdm,
    }) => {
        const result = await getHelpdeskPermission(
            fdm,
            "ticket-agent-side",
            "write",
            ticket_id,
            requester_id,
        )
        expect(result).toBeNull()
    })

    test("should let requester read their own ticket-agent-side", async ({
        fdm,
    }) => {
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

    test("should let requester read a non-internal message on their ticket", async ({
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

    test("should let the requester read an internal message on their ticket", async ({
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

    test("should let an admin read any message including internal", async ({
        fdm,
    }) => {
        const result = await getHelpdeskPermission(
            fdm,
            "message",
            "read",
            internal_message_id,
            admin_id,
        )
        expect(result).not.toBeNull()
    })

    test("should let the requester write their own message", async ({
        fdm,
    }) => {
        const result = await getHelpdeskPermission(
            fdm,
            "message",
            "write",
            public_message_id,
            requester_id,
        )
        expect(result).not.toBeNull()
    })

    test("should let admin write any message", async ({ fdm }) => {
        const result = await getHelpdeskPermission(
            fdm,
            "message",
            "write",
            public_message_id,
            admin_id,
        )
        expect(result).not.toBeNull()
    })

    test("should not let an unrelated user write a message they did not send", async ({
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
