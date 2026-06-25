import { describe, expect } from "vitest"
import {
    addAdminAgent,
    addAgent,
    getAgents,
    setAgentActiveStatus,
} from "./agent"
import { createId } from "./id"
import { addMessage, getMessagesForTicket } from "./message"
import { test } from "./test-util"
import { createTicket, getTickets } from "./ticket"

describe("getAgentWhereClause", () => {
    let admin_id: string
    let agent_id: string

    test.beforeEach(async ({ fdm }) => {
        admin_id = createId()
        await addAdminAgent(fdm, admin_id, "Admin Agent")

        agent_id = createId()
        await addAgent(fdm, admin_id, agent_id, "Regular Agent")
    })

    test("should return only active agents when isActive is true", async ({
        fdm,
    }) => {
        await setAgentActiveStatus(fdm, admin_id, agent_id, false)

        const agents = await getAgents(fdm, admin_id, { isActive: true })

        expect(agents.some((a) => a.agent_id === agent_id)).toBe(false)
        expect(agents.some((a) => a.agent_id === admin_id)).toBe(true)
    })

    test("should return only inactive agents when isActive is false", async ({
        fdm,
    }) => {
        await setAgentActiveStatus(fdm, admin_id, agent_id, false)

        const agents = await getAgents(fdm, admin_id, { isActive: false })

        expect(agents.some((a) => a.agent_id === agent_id)).toBe(true)
        expect(agents.some((a) => a.agent_id === admin_id)).toBe(false)
    })

    test("should return all agents when no activity filter is applied", async ({
        fdm,
    }) => {
        await setAgentActiveStatus(fdm, admin_id, agent_id, false)

        const agents = await getAgents(fdm, admin_id, {})

        expect(agents.some((a) => a.agent_id === agent_id)).toBe(true)
        expect(agents.some((a) => a.agent_id === admin_id)).toBe(true)
    })
})

describe("getTicketWhereClause", () => {
    const b_id_farm = "filter-clause-test-farm"

    let admin_id: string
    let requester_id: string
    let ticket_id_1: string
    let ticket_id_2: string

    test.beforeEach(async ({ fdm }) => {
        admin_id = createId()
        await addAdminAgent(fdm, admin_id, "Admin Agent")

        requester_id = createId()
        ticket_id_1 = await createTicket(fdm, requester_id, "Ticket 1", {
            context: { b_id_farm },
            priority: "high",
        })
        ticket_id_2 = await createTicket(fdm, requester_id, "Ticket 2", {
            priority: "normal",
        })
    })

    test("should filter by requester IDs", async ({ fdm }) => {
        const other_requester_id = createId()
        await createTicket(fdm, other_requester_id, "Other Ticket")

        const tickets = await getTickets(fdm, admin_id, {
            requesterIds: [requester_id],
        })

        expect(tickets.some((t) => t.ticket_id === ticket_id_1)).toBe(true)
        expect(tickets.some((t) => t.ticket_id === ticket_id_2)).toBe(true)
        expect(tickets.every((t) => t.requester_id === requester_id)).toBe(true)
    })

    test("should filter by farm context ID", async ({ fdm }) => {
        const tickets = await getTickets(fdm, admin_id, {
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

    test("should filter by minimum priority", async ({ fdm }) => {
        const tickets = await getTickets(fdm, admin_id, {
            minPriority: "high",
        })

        expect(tickets.some((t) => t.ticket_id === ticket_id_1)).toBe(true)
        expect(tickets.some((t) => t.ticket_id === ticket_id_2)).toBe(false)
    })

    test("should filter by priority range", async ({ fdm }) => {
        await createTicket(fdm, requester_id, "Urgent Ticket", {
            priority: "urgent",
        })

        const tickets = await getTickets(fdm, admin_id, {
            minPriority: "normal",
            maxPriority: "high",
        })

        expect(tickets.some((t) => t.ticket_id === ticket_id_1)).toBe(true)
        expect(tickets.some((t) => t.ticket_id === ticket_id_2)).toBe(true)
    })
})

describe("getMessageWhereClause", () => {
    let admin_id: string
    let requester_id: string
    let ticket_id: string

    test.beforeEach(async ({ fdm }) => {
        admin_id = createId()
        await addAdminAgent(fdm, admin_id, "Admin Agent")

        requester_id = createId()
        ticket_id = await createTicket(fdm, requester_id, "Ticket 1")
    })

    test("should return only public messages when isInternal is false", async ({
        fdm,
    }) => {
        await addMessage(
            fdm,
            ticket_id,
            admin_id,
            "agent",
            "Public message",
            false,
        )
        await addMessage(
            fdm,
            ticket_id,
            admin_id,
            "agent",
            "Internal message",
            true,
        )

        const messages = await getMessagesForTicket(fdm, admin_id, ticket_id, {
            isInternal: false,
        })

        expect(
            messages.some((m) => m.body === "Public message"),
            "Public message should be included",
        ).toBe(true)
        expect(
            messages.some((m) => m.body === "Internal message"),
            "Internal message should not be included when isInternal is false",
        ).toBe(false)
    })

    test("should return only internal messages when isInternal is true", async ({
        fdm,
    }) => {
        await addMessage(
            fdm,
            ticket_id,
            admin_id,
            "agent",
            "Public message",
            false,
        )
        await addMessage(
            fdm,
            ticket_id,
            admin_id,
            "agent",
            "Internal message",
            true,
        )

        const messages = await getMessagesForTicket(fdm, admin_id, ticket_id, {
            isInternal: true,
        })

        expect(
            messages.some((m) => m.body === "Internal message"),
            "Internal message should be included",
        ).toBe(true)
        expect(
            messages.some((m) => m.body === "Public message"),
            "Public message should not be included when isInternal is true",
        ).toBe(false)
    })

    test("should filter messages by sender", async ({ fdm }) => {
        const other_agent_id = createId()
        await addAgent(fdm, admin_id, other_agent_id, "Other Agent")

        await addMessage(fdm, ticket_id, admin_id, "agent", "From admin", false)
        await addMessage(
            fdm,
            ticket_id,
            other_agent_id,
            "agent",
            "From other",
            false,
        )

        const messages = await getMessagesForTicket(fdm, admin_id, ticket_id, {
            sentBy: [admin_id],
        })

        expect(
            messages.some((m) => m.body === "From admin"),
            "From admin message should be included",
        ).toBe(true)
        expect(
            messages.some((m) => m.body === "From other"),
            "From other message should not be included when filtering by sender",
        ).toBe(false)
    })
})
