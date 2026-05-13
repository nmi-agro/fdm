import { sql } from "drizzle-orm"
import { describe, expect } from "vitest"
import { addAgent, getAgent, setAgentActiveStatus, updateAgent } from "./agent"
import { createId } from "./id"
import { test } from "./test-util"

describe("Agent CRUD", () => {
    let admin_id: string
    let agent_id: string

    test.beforeEach(async ({ fdm, fdmAuth }) => {
        // Create admin_id
        const admin_username = `testagentadmin${createId(8)}`
        const admin = await fdmAuth.api.signUpEmail({
            headers: undefined,
            body: {
                email: `${admin_username}@example.agency`,
                name: "Test Agent Admin",
                username: admin_username,
                password: "password",
            },
        })
        admin_id = admin.user.id

        await fdm.execute(
            sql`update "fdm-authn"."user" set role='helpdeskAdmin' where id=${admin_id}`,
        )

        // Create agent_id
        const agent_username = `testagentagent${createId(8)}`
        const agent = await fdmAuth.api.signUpEmail({
            headers: undefined,
            body: {
                email: `${agent_username}@example.agency`,
                name: "Test Agent Agent",
                username: agent_username,
                password: "password",
            },
        })
        agent_id = agent.user.id
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

        try {
            await addAgent(fdm, agent_id, third_agent_id, "Support Agent")
            expect(true, "Should have thrown").toBe(false)
        } catch (err) {
            expect(err.message).toBeDefined()
            expect(err.message).toContain(
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
            "notimportant",
            "Third Support Agent",
        )

        try {
            await updateAgent(
                fdm,
                agent_id,
                third_agent_id,
                "Support Agent with Low Performance",
            )
            expect(true, "Should have thrown").toBe(false)
        } catch (err) {
            expect(err.message).toBeDefined()
            expect(err.message).toContain(
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
            "notimportant",
            "Third Support Agent",
        )

        try {
            await setAgentActiveStatus(fdm, agent_id, third_agent_id, false)
            expect(true, "Should have thrown").toBe(false)
        } catch (err) {
            expect(err.message).toBeDefined()
            expect(err.message).toContain(
                "Principal does not have permission to perform this action",
            )

            const agent = await getAgent(fdm, admin_id, third_agent_id)

            expect(agent.agent_id).toBe(third_agent_id)
            expect(agent.display_name).toBe("Third Support Agent")
            expect(agent.is_active).toBe(true)
        }
    })
})
