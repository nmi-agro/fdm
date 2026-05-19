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
    getTicket,
    getTicketCount,
    getTickets,
    updateTicketStatus,
    validateTicketStatusTransition,
} from "./ticket"
import {
    assignTicket,
    getAssigneesForTickets,
    getTicketCountsForAssignees,
} from "./ticket-assignment"

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
    test("should allow valid transitions from open", () => {
        expect(validateTicketStatusTransition("open", "in_progress")).toBe(true)
        expect(validateTicketStatusTransition("open", "resolved")).toBe(true)
        expect(validateTicketStatusTransition("open", "closed")).toBe(true)
    })

    test("should disallow unknown transitions", () => {
        expect(validateTicketStatusTransition("open", "open")).toBe(false)
        expect(validateTicketStatusTransition("closed", "in_progress")).toBe(
            false,
        )
        expect(validateTicketStatusTransition("unknown", "open")).toBe(false)
    })

    test("should allow reopening from resolved and closed", () => {
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

    test("should let agent update ticket status with a valid transition", async ({
        fdm,
    }) => {
        await updateTicketStatus(fdm, agent_id, ticket_id, "in_progress")

        const [ticket] = await fdm
            .select({ status: schema.tickets.status })
            .from(schema.tickets)
            .where(eq(schema.tickets.ticket_id, ticket_id))

        expect(ticket.status).toBe("in_progress")
    })

    test("should set resolved_at when transitioning to resolved", async ({
        fdm,
    }) => {
        await updateTicketStatus(fdm, agent_id, ticket_id, "resolved")

        const [ticket] = await fdm
            .select({ resolved_at: schema.tickets.resolved_at })
            .from(schema.tickets)
            .where(eq(schema.tickets.ticket_id, ticket_id))

        expect(ticket.resolved_at).toBeTruthy()
    })

    test("should not let regular user update ticket status", async ({
        fdm,
    }) => {
        await expect(
            updateTicketStatus(fdm, requester_id, ticket_id, "in_progress"),
        ).rejects.toThrow(
            "Principal does not have permission to perform this action",
        )
    })

    test("should throw on an invalid status transition", async ({ fdm }) => {
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

    test("should mark other assignments as non-primary if is_primary=true", async ({
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

    test("should not let regular user assign a ticket", async ({ fdm }) => {
        await expect(
            assignTicket(fdm, ticket_id, agent_id, requester_id),
        ).rejects.toThrow(
            "Principal does not have permission to perform this action",
        )
    })
})

describe("createTicket", () => {
    let requester_id: string

    test.beforeEach(async () => {
        requester_id = createId()
    })

    test("should create a ticket and return its id", async ({ fdm }) => {
        const ticket_id = await createTicket(
            fdm,
            requester_id,
            "My ticket body",
        )

        expect(ticket_id).toBeDefined()

        const [ticket] = await fdm
            .select()
            .from(schema.tickets)
            .where(eq(schema.tickets.ticket_id, ticket_id))

        expect(ticket.requester_id).toBe(requester_id)
        expect(ticket.channel).toBe("web")
        expect(ticket.status).toBe("open")
    })

    test("should set the priority from options", async ({ fdm }) => {
        const ticket_id = await createTicket(
            fdm,
            requester_id,
            "Urgent ticket",
            { priority: "urgent" },
        )

        const [ticket] = await fdm
            .select()
            .from(schema.tickets)
            .where(eq(schema.tickets.ticket_id, ticket_id))

        expect(ticket.priority).toBe("urgent")
    })

    test("should set the context farm id from options", async ({ fdm }) => {
        const ticket_id = await createTicket(fdm, requester_id, "Farm ticket", {
            context: { b_id_farm: "my-farm-id" },
        })

        const [ticket] = await fdm
            .select()
            .from(schema.tickets)
            .where(eq(schema.tickets.ticket_id, ticket_id))

        expect(ticket.context_farm_id).toBe("my-farm-id")
    })
})

describe("getTicket", () => {
    let admin_id: string
    let requester_id: string
    let ticket_id: string
    let tag_id: string

    test.beforeEach(async ({ fdm }) => {
        admin_id = createId()
        await addAdminAgent(fdm, admin_id, "Admin Agent")

        requester_id = createId()
        ticket_id = await createTicket(fdm, requester_id, "Test ticket")

        tag_id = await createTag(fdm, admin_id, `Tag${createId(8)}`, "#ff0000")
        await addTagToTicket(fdm, admin_id, ticket_id, tag_id)
        await assignTicket(fdm, ticket_id, admin_id, admin_id)
    })

    test("should return a ticket with its tags and assignees", async ({
        fdm,
    }) => {
        const ticket = await getTicket(fdm, admin_id, ticket_id)

        expect(ticket.ticket_id).toBe(ticket_id)
        expect(ticket.tags.some((t) => t.tag_id === tag_id)).toBe(true)
        expect(ticket.assignees.some((a) => a.agent_id === admin_id)).toBe(true)
    })

    test("should throw when an unrelated user tries to view the ticket", async ({
        fdm,
    }) => {
        const other_user_id = createId()

        await expect(getTicket(fdm, other_user_id, ticket_id)).rejects.toThrow(
            "Principal does not have permission to perform this action",
        )
    })
})

describe("getTicketCount", () => {
    let admin_id: string
    let requester_id: string

    test.beforeEach(async ({ fdm }) => {
        admin_id = createId()
        await addAdminAgent(fdm, admin_id, "Admin Agent")

        requester_id = createId()
        await createTicket(fdm, requester_id, "Ticket 1")
        await createTicket(fdm, requester_id, "Ticket 2")
        await createTicket(fdm, requester_id, "Ticket 3")
    })

    test("should return the total number of tickets", async ({ fdm }) => {
        const ticketCount = await getTicketCount(fdm, admin_id)

        expect(ticketCount).toBeGreaterThanOrEqual(3)
    })

    test("should apply filters when counting tickets", async ({ fdm }) => {
        const ticketCount = await getTicketCount(fdm, admin_id, {
            requesterIds: [requester_id],
        })

        expect(ticketCount).toBe(3)
    })
})

describe("getAssigneesForTickets", () => {
    let admin_id: string
    let agent_id: string
    let requester_id: string
    let ticket_id_1: string
    let ticket_id_2: string

    test.beforeEach(async ({ fdm }) => {
        admin_id = createId()
        await addAdminAgent(fdm, admin_id, "Admin Agent")

        agent_id = createId()
        await addAgent(fdm, admin_id, agent_id, "Regular Agent")

        requester_id = createId()
        ticket_id_1 = await createTicket(fdm, requester_id, "Ticket 1")
        ticket_id_2 = await createTicket(fdm, requester_id, "Ticket 2")

        await assignTicket(fdm, ticket_id_1, admin_id, admin_id)
        await assignTicket(fdm, ticket_id_1, agent_id, admin_id)
        // ticket_id_2 intentionally left unassigned
    })

    test("should return assignees grouped by ticket id", async ({ fdm }) => {
        const assigneesMap = await getAssigneesForTickets(fdm, admin_id, [
            ticket_id_1,
            ticket_id_2,
        ])

        const ticket1Assignees = assigneesMap.get(ticket_id_1)
        expect(ticket1Assignees).toHaveLength(2)
        expect(ticket1Assignees?.some((a) => a.agent_id === admin_id)).toBe(
            true,
        )
        expect(ticket1Assignees?.some((a) => a.agent_id === agent_id)).toBe(
            true,
        )
    })

    test("should not include entries for unassigned tickets", async ({
        fdm,
    }) => {
        const assigneesMap = await getAssigneesForTickets(fdm, admin_id, [
            ticket_id_1,
            ticket_id_2,
        ])

        expect(assigneesMap.has(ticket_id_2)).toBe(false)
    })

    test("should allow the requester to view assignees on their own ticket", async ({
        fdm,
    }) => {
        const assigneesMap = await getAssigneesForTickets(fdm, requester_id, [
            ticket_id_1,
        ])

        expect(assigneesMap.get(ticket_id_1)).toHaveLength(2)
    })

    test("should throw when an unrelated user tries to view assignees", async ({
        fdm,
    }) => {
        const other_user_id = createId()

        await expect(
            getAssigneesForTickets(fdm, other_user_id, [ticket_id_1]),
        ).rejects.toThrow(
            "Principal does not have permission to perform this action",
        )
    })
})

describe("getTicketCountsForAssignees", () => {
    let admin_id: string
    let agent_id: string
    let requester_id: string
    let ticket_id_1: string
    let ticket_id_2: string
    let ticket_id_3: string

    test.beforeEach(async ({ fdm }) => {
        admin_id = createId()
        await addAdminAgent(fdm, admin_id, "Admin Agent")

        agent_id = createId()
        await addAgent(fdm, admin_id, agent_id, "Regular Agent")

        requester_id = createId()
        ticket_id_1 = await createTicket(fdm, requester_id, "Ticket 1")
        ticket_id_2 = await createTicket(fdm, requester_id, "Ticket 2")
        ticket_id_3 = await createTicket(fdm, requester_id, "Ticket 3")

        await assignTicket(fdm, ticket_id_1, admin_id, admin_id)
        await assignTicket(fdm, ticket_id_2, admin_id, admin_id)
        await assignTicket(fdm, ticket_id_3, agent_id, admin_id)
    })

    test("should return the correct ticket count per assignee", async ({
        fdm,
    }) => {
        const counts = await getTicketCountsForAssignees(
            fdm,
            admin_id,
            [admin_id, agent_id],
            {},
        )

        expect(counts.get(admin_id)).toBe(2)
        expect(counts.get(agent_id)).toBe(1)
    })

    test("should not include agents with no assigned tickets", async ({
        fdm,
    }) => {
        const third_agent_id = createId()
        await addAgent(fdm, admin_id, third_agent_id, "Third Agent")

        const counts = await getTicketCountsForAssignees(
            fdm,
            admin_id,
            [third_agent_id],
            {},
        )

        expect(counts.has(third_agent_id)).toBe(false)
    })

    test("should apply ticket filters when counting", async ({ fdm }) => {
        const tag_id = await createTag(
            fdm,
            admin_id,
            `CountTag${createId(8)}`,
            "#123456",
        )
        await addTagToTicket(fdm, admin_id, ticket_id_1, tag_id)

        const counts = await getTicketCountsForAssignees(
            fdm,
            admin_id,
            [admin_id, agent_id],
            { tags: [tag_id] },
        )

        expect(counts.get(admin_id)).toBe(1)
        expect(counts.has(agent_id)).toBe(false)
    })
})
