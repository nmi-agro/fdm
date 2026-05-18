import { describe, expect } from "vitest"
import {
    addAdminAgent,
    addAgent,
    getAgent,
    setAgentActiveStatus,
    updateAgent,
} from "./agent"
import { createId } from "./id"
import { test } from "./test-util"

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
