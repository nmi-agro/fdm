import { eq } from "drizzle-orm"
import { describe, expect } from "vitest"
import { addAdminAgent, addAgent } from "./agent"
import * as schema from "./db/schema-helpdesk"
import { createId } from "./id"
import { addMessage, getMessagesForTicket } from "./message"
import { addTagToTicket, createTag } from "./tag"
import { test, truncateAllTables } from "./test-util"
import {
    createTicket,
    getDefaultSubjectLine,
    getInbox,
    getTicket,
    getTicketCount,
    getTickets,
    getUnassignedTicketCount,
    getUnreadAssignedTicketCount,
    getUnreadRequestedTicketCount,
    markTicketAsNotViewedByAll,
    markTicketAsViewed,
    updateTicketPriority,
    updateTicketStatus,
    updateTicketSubjectAndPriorityUnchecked,
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

        ticket_id_1 = await createTicket(fdm, requester_id, "Ticket 1. Apple", {
            context: { b_id_farm: b_id_farm },
            priority: "high",
        })
        await addMessage(
            fdm,
            ticket_id_1,
            requester_id,
            "customer",
            "Public Anchovy",
        )
        ticket_id_2 = await createTicket(
            fdm,
            requester_id,
            "Ticket 2. Banana",
            {
                priority: "normal",
            },
        )
        await addMessage(
            fdm,
            ticket_id_2,
            agent_id,
            "agent",
            "Internal Bread",
            true,
        )

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

    test("should filter by farm context", async ({ fdm }) => {
        const tickets = await getTickets(fdm, agent_id, {
            context: { b_id_farm },
        })

        expect(
            tickets.some((t) => t.ticket_id === ticket_id_1),
            "Ticket 1 (with farm context) should be in results",
        ).toBe(true)
        expect(
            tickets.some((t) => t.ticket_id === ticket_id_2),
            "Ticket 2 (no farm context) should not be in results",
        ).toBe(false)
    })

    test("should filter by priority range", async ({ fdm }) => {
        const tickets = await getTickets(fdm, agent_id, {
            minPriority: "high",
            maxPriority: "urgent",
        })

        expect(
            tickets.some((t) => t.ticket_id === ticket_id_1),
            "Ticket 1 (high priority) should be in results",
        ).toBe(true)
        expect(
            tickets.some((t) => t.ticket_id === ticket_id_2),
            "Ticket 2 (normal priority) should not be in results",
        ).toBe(false)
    })

    test("should search for text in subject", async ({ fdm }) => {
        const tickets = await getTickets(fdm, agent_id, {
            text: "banana",
        })

        expect(
            tickets.some((t) => t.ticket_id === ticket_id_1),
            "Ticket 1 (has no banana in it) should not be in the results",
        ).toBe(false)
        expect(
            tickets.some((t) => t.ticket_id === ticket_id_2),
            "Ticket 2 (has banana in the subject) should be in the results",
        ).toBe(true)
    })

    test("should search for text in messages", async ({ fdm }) => {
        const tickets = await getTickets(fdm, agent_id, {
            text: "bread",
        })

        expect(
            tickets.some((t) => t.ticket_id === ticket_id_1),
            "Ticket 1 (has no bread in it) should not be in the results",
        ).toBe(false)
        expect(
            tickets.some((t) => t.ticket_id === ticket_id_2),
            "Ticket 2 (has bread in the messages) should be in the results",
        ).toBe(true)
    })

    test("should not search for text in internal messages if the principal is not an agent", async ({
        fdm,
    }) => {
        const tickets = await getTickets(fdm, requester_id, {
            text: "internal bread",
        })

        expect(
            tickets.some((t) => t.ticket_id === ticket_id_1),
            "Ticket 1 (has no bread in it) should not be in the results",
        ).toBe(false)
        expect(
            tickets.some((t) => t.ticket_id === ticket_id_2),
            "Ticket 2 (has no bread publicly visible) should not be in the results",
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

    test("should sort by priority", async ({ fdm }) => {
        await assignTicket(fdm, ticket_id_1, agent_id, agent_id, true)
        await assignTicket(fdm, ticket_id_2, agent_id, agent_id, true)
        const tickets = await getTickets(
            fdm,
            agent_id,
            { assignees: [agent_id] },
            "priority",
        )

        expect(
            tickets[0].ticket_id,
            "Ticket 1 has a higher priority than Ticket 2",
        ).toBe(ticket_id_1)
        expect(tickets[1].ticket_id).toBe(ticket_id_2)
    })

    test("should sort by text relevance", async ({ fdm }) => {
        const specific_ticket_id_1 = await createTicket(
            fdm,
            requester_id,
            "New helpdesk feature",
        )
        const specific_ticket_id_2 = await createTicket(
            fdm,
            requester_id,
            "New feature",
        )
        await assignTicket(fdm, specific_ticket_id_1, agent_id, agent_id, true)
        await assignTicket(fdm, specific_ticket_id_2, agent_id, agent_id, true)

        // "New feature" should score higher than "New helpdesk feature" since it is the exact same phrase
        const tickets = await getTickets(
            fdm,
            agent_id,
            { assignees: [agent_id], text: "New feature" },
            "text_relevance",
        )

        expect(
            tickets[0].ticket_id,
            "Ticket 2 contains the search terms as is while Ticket 1 doesnt",
        ).toBe(specific_ticket_id_2)
        expect(tickets[1].ticket_id).toBe(specific_ticket_id_1)
    })
})

describe("updateTicketSubjectAndPriorityUnchecked", () => {
    let agent_id: string

    test.beforeEach(async ({ fdm }) => {
        agent_id = createId()
        await addAdminAgent(fdm, agent_id, "Support Agent")
    })

    test("should update without any permission checks", async ({ fdm }) => {
        const ticket_id = await createTicket(fdm, agent_id, "Ticket 1")
        await updateTicketSubjectAndPriorityUnchecked(
            fdm,
            ticket_id,
            "Ticket 1 Subject",
            "high",
        )
        const ticket = await getTicket(fdm, agent_id, ticket_id)
        expect(ticket.subject).toBe("Ticket 1 Subject")
        expect(ticket.priority).toBe("high")
        expect(ticket.updated).not.toBeNull()
    })

    test("should be able to update subject only", async ({ fdm }) => {
        const ticket_id = await createTicket(fdm, agent_id, "Ticket 1", {
            priority: "high",
        })
        await updateTicketSubjectAndPriorityUnchecked(
            fdm,
            ticket_id,
            "Ticket 1 Subject",
        )
        const ticket = await getTicket(fdm, agent_id, ticket_id)
        expect(ticket.subject).toBe("Ticket 1 Subject")
        expect(ticket.priority).toBe("high")
        expect(ticket.updated).not.toBeNull()
    })

    test("should be able to update priority only", async ({ fdm }) => {
        const ticket_id = await createTicket(fdm, agent_id, "Ticket 1", {
            priority: "high",
        })
        await updateTicketSubjectAndPriorityUnchecked(
            fdm,
            ticket_id,
            undefined,
            "low",
        )
        const ticket = await getTicket(fdm, agent_id, ticket_id)
        expect(ticket.subject).toBe("Ticket 1")
        expect(ticket.priority).toBe("low")
        expect(ticket.updated).not.toBeNull()
    })
})

describe("updateTicketPriority", () => {
    let agent_id: string
    let requester_id: string
    let ticket_id: string

    test.beforeEach(async ({ fdm }) => {
        agent_id = createId()
        requester_id = createId()
        await addAdminAgent(fdm, agent_id, "Support Agent")
        ticket_id = await createTicket(fdm, requester_id, "Ticket 1")
    })

    test("should let agents update the priority", async ({ fdm }) => {
        await updateTicketPriority(fdm, agent_id, ticket_id, "high")
        const ticket = await getTicket(fdm, agent_id, ticket_id)
        expect(ticket.priority).toBe("high")
        expect(ticket.updated).not.toBeNull()
    })

    test("should not let regular users update the priority", async ({
        fdm,
    }) => {
        try {
            await updateTicketPriority(fdm, requester_id, ticket_id, "high")
        } catch (_err) {
            const ticket = await getTicket(fdm, requester_id, ticket_id)
            expect(ticket.priority).toBe("normal")
            expect(ticket.updated).toBeNull()
            return
        }

        throw new Error("Should have thrown")
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

    test("should not update close time if closing twice", async ({ fdm }) => {
        const closeDate = new Date(2023, 0, 1)

        // Set an old date so we are certain now() will land after this
        // This will be like the ticket has been closed before,
        // and is enough to test if the closed_at date is not overridden
        await fdm
            .update(schema.tickets)
            .set({ closed_at: closeDate })
            .where(eq(schema.tickets.ticket_id, ticket_id))

        // Close again
        await updateTicketStatus(fdm, agent_id, ticket_id, "closed")

        const ticketAfter = await getTicket(fdm, agent_id, ticket_id)

        expect(ticketAfter.closed_at).toBeTruthy()
        expect(
            Math.abs(
                (ticketAfter.closed_at as Date).getTime() - closeDate.getTime(),
            ),
            "Ticket close date must not change",
        ).toBeLessThan(1000)
    })

    test("should clear the closed_at date if opening again", async ({
        fdm,
    }) => {
        await updateTicketStatus(fdm, agent_id, ticket_id, "closed")
        await updateTicketStatus(fdm, agent_id, ticket_id, "open")
        const ticketAfter = await getTicket(fdm, agent_id, ticket_id)
        expect(ticketAfter.closed_at).toBeNull()
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

    test("should escape HTML in the body", async ({ fdm }) => {
        const ticket_id = await createTicket(
            fdm,
            requester_id,
            `"test"<script>alert('xss')</script>`,
        )

        const ticket = await getTicket(fdm, requester_id, ticket_id)

        const messages = await getMessagesForTicket(
            fdm,
            requester_id,
            ticket_id,
        )

        const escaped =
            "&quot;test&quot;&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;"
        expect(ticket.subject).toBe(escaped.slice(0, 100))
        expect(messages[0].body).toBe(escaped)
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

describe("getTicketCount wrappers", async () => {
    let admin_id: string
    let requester_id: string

    test.beforeEach(async ({ fdm }) => {
        await truncateAllTables(fdm)
        admin_id = createId()
        await addAdminAgent(fdm, admin_id, "Admin Agent")

        requester_id = createId()
        await createTicket(fdm, requester_id, "Ticket 1")
        await createTicket(fdm, admin_id, "Ticket 2")
        const assigned_ticket = await createTicket(
            fdm,
            requester_id,
            "Ticket 3",
        )
        await assignTicket(fdm, assigned_ticket, admin_id, admin_id, true)
    })

    test("should get the number of unassigned tickets", async ({ fdm }) => {
        const ticketCount = await getUnassignedTicketCount(fdm, admin_id)
        expect(ticketCount).toBe(2)
    })

    test("should get the number of unread and requested tickets", async ({
        fdm,
    }) => {
        const ticketCount = await getUnreadRequestedTicketCount(
            fdm,
            requester_id,
        )
        expect(ticketCount).toBe(2)
    })

    test("should get the number of unread and assigned tickets", async ({
        fdm,
    }) => {
        const ticketCount = await getUnreadAssignedTicketCount(fdm, admin_id)
        expect(ticketCount).toBe(1)
    })
})

describe("getDefaultTicketSubject", () => {
    const short = "Lorem ipsum"
    const normal =
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam"
    const otherWhitespace =
        "Lorem\r\nipsum dolor\tsit\tamet,         consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam"
    const longWords =
        "Loremipsumdolorsitametconsectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam"
    const veryLongFirstWord =
        "Loremipsumdolorsitametconsecteturadipiscingelitseddoeiusmodtemporincididuntutlaboreetdoloremagnaaliqu autenim ad minim veniam"
    const veryLongSecondWord =
        "Lorem ipsumdolorsitametconsecteturadipiscingelitseddoeiusmodtemporincididuntutlaboreetdoloremagnaaliqu autenim ad minim veniam"

    test("should handle empty body", () => {
        expect(getDefaultSubjectLine("")).toBe("")
    })
    test("should handle short body", () => {
        expect(getDefaultSubjectLine(short)).toBe(short)
    })
    test("should get the first few words", () => {
        expect(getDefaultSubjectLine(normal)).toBe(normal.slice(0, 99))
    })
    test("should get the first few words 2", () => {
        expect(getDefaultSubjectLine(longWords)).toBe(longWords.slice(0, 96))
    })
    test("should break first word if subject is becoming too short", () => {
        expect(getDefaultSubjectLine(veryLongFirstWord)).toBe(
            veryLongFirstWord.slice(0, 20),
        )
    })
    test("should break second word if subject is becoming too short", () => {
        expect(getDefaultSubjectLine(veryLongSecondWord)).toBe(
            veryLongSecondWord.slice(0, 20),
        )
    })
    test("should handle other whitespace", () => {
        expect(getDefaultSubjectLine(otherWhitespace)).toBe(normal.slice(0, 99))
    })
})

describe("markTicketAsViewed", () => {
    let requester_id: string
    let ticket_id: string

    test.beforeEach(async ({ fdm }) => {
        requester_id = createId()
        ticket_id = await createTicket(fdm, requester_id, "Ticket 1")
    })

    test("should mark the ticket as viewed for the agent", async ({ fdm }) => {
        await markTicketAsViewed(fdm, requester_id, ticket_id)

        const ticket = await getTicket(fdm, requester_id, ticket_id)

        expect(ticket.viewed_at).toBeTruthy()
    })

    test("should update read time", async ({ fdm }) => {
        await markTicketAsViewed(fdm, requester_id, ticket_id)

        const ticketFirst = await getTicket(fdm, requester_id, ticket_id)

        await markTicketAsViewed(fdm, requester_id, ticket_id)

        const ticketSecond = await getTicket(fdm, requester_id, ticket_id)

        expect(ticketFirst.viewed_at).not.toEqual(ticketSecond.viewed_at)
    })

    test("should throw an error if the actor cannot read the ticket", async ({
        fdm,
    }) => {
        const third_user_id = createId()
        await expect(
            markTicketAsViewed(fdm, third_user_id, ticket_id),
        ).rejects.toThrow(
            "Principal does not have permission to perform this action",
        )
    })
})

describe("markTicketAsNotViewedByAll", () => {
    test("should mark ticket as not viewed by all", async ({ fdm }) => {
        const requester_id = createId()
        const ticket_id = await createTicket(fdm, requester_id, "Ticket")
        await markTicketAsViewed(fdm, requester_id, ticket_id)
        await markTicketAsNotViewedByAll(fdm, ticket_id)

        const ticket = await getTicket(fdm, requester_id, ticket_id)
        expect(
            ticket.viewed_at,
            "Ticket viewed date must be null after un-viewing",
        ).toBeNull()
    })
})
