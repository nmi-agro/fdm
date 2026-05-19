import { eq } from "drizzle-orm"
import { describe, expect } from "vitest"
import { addAdminAgent, addAgent } from "./agent"
import * as schema from "./db/schema-helpdesk"
import { createId } from "./id"
import { addTagToTicket, createTag } from "./tag"
import { test } from "./test-util"
import {
    createTicket,
    getInbox,
    getTickets,
    updateTicketStatus,
    validateTicketStatusTransition,
} from "./ticket"
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

    test.beforeEach(async ({ fdm }) => {
        // Create agent_id
        agent_id = createId()

        await addAdminAgent(fdm, agent_id, "Support Agent")

        // Create requester_id
        requester_id = createId()

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

    test.beforeEach(async ({ fdm }) => {
        // Create agent_id
        agent_id = createId()

        await addAdminAgent(fdm, agent_id, "Support Agent")

        // Create requester_id
        requester_id = createId()

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
            tags: [orange_tag_id],
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

describe("validateTicketStatusTransition", () => {
    test("allows valid transitions from open", () => {
        expect(validateTicketStatusTransition("open", "in_progress")).toBe(true)
        expect(validateTicketStatusTransition("open", "resolved")).toBe(true)
        expect(validateTicketStatusTransition("open", "closed")).toBe(true)
    })

    test("disallows unknown transitions", () => {
        expect(validateTicketStatusTransition("open", "open")).toBe(false)
        expect(validateTicketStatusTransition("closed", "in_progress")).toBe(
            false,
        )
        expect(validateTicketStatusTransition("unknown", "open")).toBe(false)
    })

    test("allows reopening from resolved and closed", () => {
        expect(validateTicketStatusTransition("resolved", "open")).toBe(true)
        expect(validateTicketStatusTransition("closed", "open")).toBe(true)
    })
})

describe("updateTicketStatus", () => {
    let admin_id: string
    let agent_id: string
    let requester_id: string
    let ticket_id: string

    test.beforeEach(async ({ fdm }) => {
        admin_id = createId()
        await addAdminAgent(fdm, admin_id, "Admin Agent")

        agent_id = createId()
        await addAgent(fdm, admin_id, agent_id, "Regular Agent")

        requester_id = createId()
        ticket_id = await createTicket(fdm, requester_id, "Test ticket")
    })

    test("agent can update ticket status with a valid transition", async ({
        fdm,
    }) => {
        await updateTicketStatus(fdm, agent_id, ticket_id, "in_progress")

        const [ticket] = await fdm
            .select({ status: schema.tickets.status })
            .from(schema.tickets)
            .where(eq(schema.tickets.ticket_id, ticket_id))

        expect(ticket.status).toBe("in_progress")
    })

    test("sets resolved_at when transitioning to resolved", async ({ fdm }) => {
        await updateTicketStatus(fdm, agent_id, ticket_id, "resolved")

        const [ticket] = await fdm
            .select({ resolved_at: schema.tickets.resolved_at })
            .from(schema.tickets)
            .where(eq(schema.tickets.ticket_id, ticket_id))

        expect(ticket.resolved_at).toBeTruthy()
    })

    test("regular user cannot update ticket status", async ({ fdm }) => {
        await expect(
            updateTicketStatus(fdm, requester_id, ticket_id, "in_progress"),
        ).rejects.toThrow(
            "Principal does not have permission to perform this action",
        )
    })

    test("throws on an invalid status transition", async ({ fdm }) => {
        // First transition to "resolved" (valid: open → resolved)
        await updateTicketStatus(fdm, agent_id, ticket_id, "resolved")

        // Now attempt an invalid transition (resolved → in_progress is not allowed)
        await expect(
            updateTicketStatus(fdm, agent_id, ticket_id, "in_progress"),
        ).rejects.toThrow()

        // Sanity check: status must remain unchanged after a failed transition
        const [ticket] = await fdm
            .select({ status: schema.tickets.status })
            .from(schema.tickets)
            .where(eq(schema.tickets.ticket_id, ticket_id))

        expect(ticket.status).toBe("resolved")
    })
})

describe("assignTicket", () => {
    let admin_id: string
    let agent_id: string
    let second_agent_id: string
    let requester_id: string
    let ticket_id: string

    test.beforeEach(async ({ fdm }) => {
        admin_id = createId()
        await addAdminAgent(fdm, admin_id, "Admin Agent")

        agent_id = createId()
        await addAgent(fdm, admin_id, agent_id, "Agent One")

        second_agent_id = createId()
        await addAgent(fdm, admin_id, second_agent_id, "Agent Two")

        requester_id = createId()
        ticket_id = await createTicket(fdm, requester_id, "Test ticket")
    })

    test("is_primary=true clears other primary assignments", async ({
        fdm,
    }) => {
        await assignTicket(fdm, ticket_id, agent_id, admin_id, true)
        await assignTicket(fdm, ticket_id, second_agent_id, admin_id, true)

        const assignments = await fdm
            .select({
                agent_id: schema.ticketAssignments.agent_id,
                is_primary: schema.ticketAssignments.is_primary,
            })
            .from(schema.ticketAssignments)
            .where(eq(schema.ticketAssignments.ticket_id, ticket_id))

        const firstAgent = assignments.find((a) => a.agent_id === agent_id)
        const secondAgent = assignments.find(
            (a) => a.agent_id === second_agent_id,
        )

        expect(firstAgent?.is_primary).toBe(false)
        expect(secondAgent?.is_primary).toBe(true)
    })

    test("regular user (non-agent) cannot assign a ticket", async ({ fdm }) => {
        await expect(
            assignTicket(fdm, ticket_id, agent_id, requester_id),
        ).rejects.toThrow(
            "Principal does not have permission to perform this action",
        )
    })
})
