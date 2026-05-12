import { sql } from "drizzle-orm"
import { describe, expect } from "vitest"
import { addAgent, getAgent } from "./agent"
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

    test("should not let regular helpdesk agents create agents", async ({
        fdm,
    }) => {
        const third_agent_id = createId()

        try {
            await addAgent(fdm, agent_id, third_agent_id, "Support Agent")
            expect(true, "Should have thrown").toBe(false)
        } catch (err) {
            expect(err.message).toBeDefined()
            expect(err.message).toContain("perform")
        }
    })
})
