import { describe, expect } from "vitest"
import {
    addAdminAgent,
    addAgent,
    getAgent,
    getAgentCount,
    getAgents,
    setAgentActiveStatus,
    updateAgent,
    updateAgentRole,
} from "./agent"
import { createId } from "./id"
import { test, truncateAllTables } from "./test-util"

// Truncate all tables before each test so every test starts with a clean,
// isolated database state. This enables exact-count assertions and reliably
// exercises constraints such as the "last admin" guard.
test.beforeEach(async ({ fdm }) => {
    await truncateAllTables(fdm)
})

describe("Agent CRUD", () => {
    let admin_id: string
    let agent_id: string

    test.beforeEach(async ({ fdm }) => {
        // Create admin_id
        admin_id = createId()

        await addAdminAgent(fdm, admin_id, "Admin Agent")

        // Create agent_id
        agent_id = createId()

        await addAgent(fdm, admin_id, agent_id, "Support Agent")
    })

    test("should create an admin agent without permission checks", async ({
        fdm,
    }) => {
        const agent_id = createId()
        await addAdminAgent(fdm, agent_id, "Helpdesk Admin")
    })

    test("should not overwrite existing agent as admin", async ({ fdm }) => {
        const failError = new Error("Should have thrown")
        try {
            await addAdminAgent(fdm, admin_id, "Helpdesk Admin")
            throw failError
        } catch (err) {
            if (err === failError) throw err
            const error = err as Error
            expect(error.cause).toBeDefined()
            expect((error.cause as Error).message).toBe(
                "Agent with same ID already exists",
            )
        }
    })

    test("should let admins add agents", async ({ fdm }) => {
        await addAgent(fdm, admin_id, agent_id, "Support Agent")

        const agent = await getAgent(fdm, admin_id, agent_id)

        expect(agent.agent_id).toBe(agent_id)
        expect(agent.display_name).toBe("Support Agent")
        expect(agent.is_active).toBe(true)
    })

    test("should update existing agent if adding with the same id", async ({
        fdm,
    }) => {
        await addAgent(fdm, admin_id, agent_id, "Support Agent")
        await addAgent(fdm, admin_id, agent_id, "Updated Support Agent")

        const agent = await getAgent(fdm, admin_id, agent_id)

        expect(agent.agent_id).toBe(agent_id)
        expect(agent.display_name).toBe("Updated Support Agent")
        expect(agent.is_active).toBe(true)
    })

    test("should not let regular helpdesk agents create agents", async ({
        fdm,
    }) => {
        const third_agent_id = createId()

        const failError = new Error("Should have thrown")
        try {
            await addAgent(fdm, agent_id, third_agent_id, "Support Agent")
            throw failError
        } catch (err) {
            if (err === failError) throw err
            const error = err as Error
            expect(error.message).toBeDefined()
            expect(error.message).toContain(
                "Principal does not have permission to perform this action",
            )

            await expect(
                getAgent(fdm, admin_id, third_agent_id),
            ).rejects.toThrow(
                "Principal does not have permission to perform this action",
            )
        }
    })

    test("should let admins update any agent", async ({ fdm }) => {
        await addAgent(fdm, admin_id, agent_id, "Support Agent")
        await updateAgent(fdm, admin_id, agent_id, "Updated Support Agent")

        const agent = await getAgent(fdm, admin_id, agent_id)

        expect(agent.agent_id).toBe(agent_id)
        expect(agent.display_name).toBe("Updated Support Agent")
        expect(agent.is_active).toBe(true)
    })

    test("should not let regular helpdesk agents update each other's information", async ({
        fdm,
    }) => {
        const third_agent_id = await addAgent(
            fdm,
            admin_id,
            `thirdagent${createId(8)}`,
            "Third Support Agent",
        )

        const failError = new Error("Should have thrown")
        try {
            await updateAgent(
                fdm,
                agent_id,
                third_agent_id,
                "Support Agent with Low Performance",
            )
            throw failError
        } catch (err) {
            if (err === failError) throw err
            const error = err as Error
            expect(error.message).toBeDefined()
            expect(error.message).toContain(
                "Principal does not have permission to perform this action",
            )

            const agent = await getAgent(fdm, admin_id, third_agent_id)

            expect(agent.agent_id).toBe(third_agent_id)
            expect(agent.display_name).toBe("Third Support Agent")
            expect(agent.is_active).toBe(true)
        }
    })

    test("should let admins update agent status", async ({ fdm }) => {
        await addAgent(fdm, admin_id, agent_id, "Support Agent")
        await setAgentActiveStatus(fdm, admin_id, agent_id, false)

        const agent = await getAgent(fdm, admin_id, agent_id)

        expect(agent.agent_id).toBe(agent_id)
        expect(agent.display_name).toBe("Support Agent")
        expect(agent.is_active).toBe(false)
    })

    test("should not allow deactivating the last active admin", async ({
        fdm,
    }) => {
        const failError = new Error("Should have thrown")
        try {
            await setAgentActiveStatus(fdm, admin_id, admin_id, false)
            throw failError
        } catch (err) {
            if (err === failError) throw err
            const error = err as Error
            expect(error.cause).toBeDefined()
            expect((error.cause as Error).message).toBe(
                "There must be at least one admin left",
            )
        }
    })

    test("should not let regular helpdesk agents update each other's information", async ({
        fdm,
    }) => {
        const third_agent_id = await addAgent(
            fdm,
            admin_id,
            `thirdagent${createId(8)}`,
            "Third Support Agent",
        )

        const failError = new Error("Should have thrown")
        try {
            await setAgentActiveStatus(fdm, agent_id, third_agent_id, false)
            throw failError
        } catch (err) {
            if (err === failError) throw err
            const error = err as Error
            expect(error.message).toBeDefined()
            expect(error.message).toContain(
                "Principal does not have permission to perform this action",
            )

            const agent = await getAgent(fdm, admin_id, third_agent_id)

            expect(agent.agent_id).toBe(third_agent_id)
            expect(agent.display_name).toBe("Third Support Agent")
            expect(agent.is_active).toBe(true)
        }
    })
})

describe("getAgents", () => {
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

    test("admin can list all agents", async ({ fdm }) => {
        const agents = await getAgents(fdm, admin_id)
        expect(agents.some((a) => a.agent_id === admin_id)).toBe(true)
        expect(agents.some((a) => a.agent_id === agent_id)).toBe(true)
        expect(agents.length).toBe(2)
    })

    test("regular agent can list agents", async ({ fdm }) => {
        const agents = await getAgents(fdm, agent_id)
        expect(agents.length).toBe(2)
    })

    test("regular user cannot list agents", async ({ fdm }) => {
        await expect(getAgents(fdm, user_id)).rejects.toThrow(
            "Principal does not have permission to perform this action",
        )
    })

    test("should return empty list when filtering for inactive agents with none inactive", async ({
        fdm,
    }) => {
        const agents = await getAgents(fdm, admin_id, { isActive: false })
        expect(agents).toHaveLength(0)
    })
})

describe("getAgentCount", () => {
    let admin_id: string
    let user_id: string

    test.beforeEach(async ({ fdm }) => {
        admin_id = createId()
        await addAdminAgent(fdm, admin_id, "Admin Agent")

        for (let i = 0; i < 3; i++) {
            await addAgent(fdm, admin_id, createId(), `Agent ${i}`)
        }

        user_id = createId()
    })

    test("should return the total number of agents", async ({ fdm }) => {
        const agentCount = await getAgentCount(fdm, admin_id, {})

        // 1 admin + 3 agents added in beforeEach
        expect(agentCount).toBe(4)
    })

    test("should return 0 when no inactive agents exist", async ({ fdm }) => {
        const count = await getAgentCount(fdm, admin_id, { isActive: false })
        expect(count).toBe(0)
    })

    test("should throw when a regular user tries to get agent count", async ({
        fdm,
    }) => {
        await expect(getAgentCount(fdm, user_id, {})).rejects.toThrow(
            "Principal does not have permission to perform this action",
        )
    })
})

describe("updateAgentRole", () => {
    let admin_id: string
    let agent_id: string

    test.beforeEach(async ({ fdm }) => {
        admin_id = createId()
        await addAdminAgent(fdm, admin_id, "Admin Agent")

        agent_id = createId()
        await addAgent(fdm, admin_id, agent_id, "Regular Agent")
    })

    test("should allow admin to promote an agent to admin role", async ({
        fdm,
    }) => {
        await updateAgentRole(fdm, admin_id, agent_id, "admin")
        const agent = await getAgent(fdm, admin_id, agent_id)
        expect(agent.role).toBe("admin")
    })

    test("should not allow demoting the last active admin", async ({ fdm }) => {
        const failError = new Error("Should have thrown")
        try {
            await updateAgentRole(fdm, admin_id, admin_id, "agent")
            throw failError
        } catch (err) {
            if (err === failError) throw err
            const error = err as Error
            expect(error.cause).toBeDefined()
            expect((error.cause as Error).message).toBe(
                "There must be at least one active admin left",
            )
        }
    })

    test("should allow demoting an admin when another admin exists", async ({
        fdm,
    }) => {
        const second_admin_id = createId()
        await addAdminAgent(fdm, second_admin_id, "Second Admin")
        await updateAgentRole(fdm, admin_id, admin_id, "agent")
        const agent = await getAgent(fdm, admin_id, admin_id)
        expect(agent.role).toBe("agent")
    })

    test("should not let regular agents change agent roles", async ({ fdm }) => {
        await expect(
            updateAgentRole(fdm, agent_id, admin_id, "agent"),
        ).rejects.toThrow(
            "Principal does not have permission to perform this action",
        )
    })
})
