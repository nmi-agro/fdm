import { eq, sql } from "drizzle-orm"
import { expect } from "vitest"
import { addAdminAgent } from "./agent"
import * as schema from "./db/schema-helpdesk"
import { createId } from "./id"
import { addTagToTicket, createTag } from "./tag"
import { test } from "./test-util"
import { createTicket, getInbox, getTickets } from "./ticket"
import { assignTicket } from "./ticket-assignment"

test.describe("Inbox", () => {
    const b_id_farm = "test-farm-id"

    let agent_id: string
    let requester_id: string
    let ticket_id_1: string
    let ticket_id_2: string
    let ticket_id_3: string
    let blue_tag_id: string
    let blue_tag_name: string
    let orange_tag_id: string
    let orange_tag_name: string

    test.beforeEach(async ({ fdm, fdmAuth }) => {
        // Create agent_id
        const agent_username = `testinboxagent${createId(8)}`
        const agent = await fdmAuth.api.signUpEmail({
            headers: undefined,
            body: {
                email: `${agent_username}@example.agency`,
                name: "Test Inbox Agent",
                username: agent_username,
                password: "password",
            },
        })
        agent_id = agent.user.id

        await addAdminAgent(fdm, agent_id, "Support Agent")

        // Create requester_id
        const requester_username = `testinboxrequester${createId(8)}`
        const requester = await fdmAuth.api.signUpEmail({
            headers: undefined,
            body: {
                email: `${requester_username}@example.client`,
                name: "Test Inbox Requester",
                username: requester_username,
                password: "password",
            },
        })
        requester_id = requester.user.id

        ticket_id_1 = await createTicket(fdm, requester_id, "Ticket 1", {
            context: { b_id_farm: b_id_farm },
            priority: "high",
        })
        ticket_id_2 = await createTicket(fdm, requester_id, "Ticket 2", {
            priority: "normal",
        })
        ticket_id_3 = await createTicket(fdm, requester_id, "Ticket 3", {
            context: { b_id_farm: b_id_farm },
            priority: "low",
        })

        await assignTicket(fdm, ticket_id_1, agent_id, agent_id)
        await assignTicket(fdm, ticket_id_2, agent_id, agent_id)

        blue_tag_name = `Blue${createId(8)}`
        blue_tag_id = await createTag(
            fdm,
            agent_id,
            blue_tag_name,
            "#0000ff",
            "This is a blue tag.",
        )
        orange_tag_name = `Orange${createId(8)}`
        orange_tag_id = await createTag(
            fdm,
            agent_id,
            orange_tag_name,
            "#ff8844",
            "This is an orange tag.",
        )

        await addTagToTicket(fdm, agent_id, ticket_id_1, blue_tag_id)
        await addTagToTicket(fdm, agent_id, ticket_id_2, orange_tag_id)
    })

    test("should get an agent's inbox", async ({ fdm }) => {
        const inbox = await getInbox(fdm, agent_id)

        expect(inbox).toHaveLength(2)
        expect(
            inbox.some((ticket) => ticket.ticket_id === ticket_id_1),
            "Ticket 1 is not found in inbox",
        ).toBe(true)
        expect(
            inbox.some((ticket) => ticket.ticket_id === ticket_id_2),
            "Ticket 2 is not found in inbox",
        ).toBe(true)
    })

    test("should not get unassigned tickets", async ({ fdm }) => {
        const inbox = await getInbox(fdm, agent_id)
        expect(
            inbox.some((ticket) => ticket.ticket_id === ticket_id_3),
            "Ticket 3 is found in inbox but shouldn't be",
        ).toBe(false)
    })
})

test.describe("getTickets", () => {
    const b_id_farm = "test-farm-id"

    let agent_id: string
    let requester_id: string
    let ticket_id_1: string
    let ticket_id_2: string
    let blue_tag_id: string
    let blue_tag_name: string
    let orange_tag_id: string
    let orange_tag_name: string

    test.beforeEach(async ({ fdm, fdmAuth }) => {
        // Create agent_id
        const agent_username = `testinboxagent${createId(8)}`
        const agent = await fdmAuth.api.signUpEmail({
            headers: undefined,
            body: {
                email: `${agent_username}@example.agency`,
                name: "Test Inbox Agent",
                username: agent_username,
                password: "password",
            },
        })
        agent_id = agent.user.id

        await addAdminAgent(fdm, agent_id, "Support Agent")

        // Create requester_id
        const requester_username = `testinboxrequester${createId(8)}`
        const requester = await fdmAuth.api.signUpEmail({
            headers: undefined,
            body: {
                email: `${requester_username}@example.client`,
                name: "Test Inbox Requester",
                username: requester_username,
                password: "password",
            },
        })
        requester_id = requester.user.id

        ticket_id_1 = await createTicket(fdm, requester_id, "Ticket 1", {
            context: { b_id_farm: b_id_farm },
            priority: "high",
        })
        ticket_id_2 = await createTicket(fdm, requester_id, "Ticket 2", {
            priority: "normal",
        })

        blue_tag_name = `Blue${createId(8)}`
        blue_tag_id = await createTag(
            fdm,
            agent_id,
            blue_tag_name,
            "#0000ff",
            "This is a blue tag.",
        )
        orange_tag_name = `Orange${createId(8)}`
        orange_tag_id = await createTag(
            fdm,
            agent_id,
            orange_tag_name,
            "#ff8844",
            "This is an orange tag.",
        )

        await addTagToTicket(fdm, agent_id, ticket_id_1, blue_tag_id)
        await addTagToTicket(fdm, agent_id, ticket_id_2, orange_tag_id)
    })

    test("should filter by tag", async ({ fdm }) => {
        const inbox = await getTickets(fdm, agent_id, {
            tags: [orange_tag_name],
        })

        expect(inbox).toHaveLength(1)
        expect(
            inbox.some((ticket) => ticket.ticket_id === ticket_id_1),
            "Ticket 1 is found in inbox but shouldn't be",
        ).toBe(false)
        expect(
            inbox.some((ticket) => ticket.ticket_id === ticket_id_2),
            "Ticket 2 is not found in inbox",
        ).toBe(true)
    })

    test("should filter by from-date", async ({ fdm }) => {
        const new_ticket_id = await createTicket(
            fdm,
            requester_id,
            "Ticket In The Future",
            {
                context: { b_id_farm: b_id_farm },
                priority: "low",
            },
        )

        await fdm
            .update(schema.tickets)
            .set({ created: new Date(2023, 0, 8) })
            .where(eq(schema.tickets.ticket_id, new_ticket_id))

        const inbox = await getTickets(fdm, agent_id, {
            fromDate: new Date(2023, 0, 9),
        })
        expect(
            inbox.some((ticket) => ticket.ticket_id === new_ticket_id),
            "New ticket created in the future is found in inbox but shouldn't be",
        ).toBe(false)
    })

    test("should filter by to-date", async ({ fdm }) => {
        const new_ticket_id = await createTicket(
            fdm,
            requester_id,
            "Ticket 3",
            {
                context: { b_id_farm: b_id_farm },
                priority: "low",
            },
        )

        await fdm
            .update(schema.tickets)
            .set({ created: new Date(2023, 0, 10) })
            .where(eq(schema.tickets.ticket_id, new_ticket_id))

        const inbox = await getTickets(fdm, agent_id, {
            toDate: new Date(2023, 0, 9),
        })
        expect(
            inbox.some((ticket) => ticket.ticket_id === new_ticket_id),
            "New ticket created in the past is found in inbox but shouldn't be",
        ).toBe(false)
    })

    test("should only list regular user's own tickets", async ({ fdm }) => {
        const new_ticket_id = await createTicket(
            fdm,
            agent_id,
            "Ticket by Agent",
            {
                context: { b_id_farm: b_id_farm },
                priority: "low",
            },
        )

        const inbox = await getTickets(fdm, requester_id)

        expect(inbox).toHaveLength(2)
        expect(
            inbox.some((ticket) => ticket.ticket_id === ticket_id_1),
            "Ticket 1 is not found in inbox",
        ).toBe(true)
        expect(
            inbox.some((ticket) => ticket.ticket_id === ticket_id_2),
            "Ticket 2 is not found in inbox",
        ).toBe(true)
        expect(
            inbox.some((ticket) => ticket.ticket_id === new_ticket_id),
            "New ticket created by other user found in inbox but shouldn't be",
        ).toBe(false)
    })
})
