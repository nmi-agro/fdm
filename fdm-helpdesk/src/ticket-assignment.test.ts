import { describe, expect } from "vitest"
import { addAdminAgent, addAgent, updateAgentRole } from "./agent"
import { FdmHelpdeskType } from "./fdm-helpdesk.types"
import { createId } from "./id"
import { addTagToTicket, createTag } from "./tag"
import { test, truncateAllTables } from "./test-util"
import { createTicket } from "./ticket"
import {
  assignTicket,
  assignTicketToAnAdmin,
  assignTicketUnchecked,
  getAssigneesForTickets,
  getAssigneesForTicketsUnchecked,
  getAssignmentHistoryForTicket,
  getTicketCountsForAssignees,
  unassignTicket,
} from "./ticket-assignment"

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
    const assigneesMap = await getAssigneesForTickets(fdm, admin_id, [ticket_id_1, ticket_id_2])

    const ticket1Assignees = assigneesMap.get(ticket_id_1)
    expect(ticket1Assignees).toHaveLength(2)
    expect(ticket1Assignees?.some((a) => a.agent_id === admin_id)).toBe(true)
    expect(ticket1Assignees?.some((a) => a.agent_id === agent_id)).toBe(true)
  })

  test("should not include entries for unassigned tickets", async ({ fdm }) => {
    const assigneesMap = await getAssigneesForTickets(fdm, admin_id, [ticket_id_1, ticket_id_2])

    expect(assigneesMap.has(ticket_id_2)).toBe(false)
  })

  test("should allow the requester to view assignees on their own ticket", async ({ fdm }) => {
    const assigneesMap = await getAssigneesForTickets(fdm, requester_id, [ticket_id_1])

    expect(assigneesMap.get(ticket_id_1)).toHaveLength(2)
  })

  test("should throw when an unrelated user tries to view assignees", async ({ fdm }) => {
    const other_user_id = createId()

    await expect(getAssigneesForTickets(fdm, other_user_id, [ticket_id_1])).rejects.toThrow(
      "Principal does not have permission to perform this action",
    )
  })
})

describe("getAssigneesForTicketsUnchecked", () => {
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

  test("should return assignees grouped by ticket id without any permission check", async ({
    fdm,
  }) => {
    const assigneesMap = await getAssigneesForTicketsUnchecked(fdm, [ticket_id_1, ticket_id_2])

    const ticket1Assignees = assigneesMap.get(ticket_id_1)
    expect(ticket1Assignees).toHaveLength(2)
    expect(ticket1Assignees?.some((a) => a.agent_id === admin_id)).toBe(true)
    expect(ticket1Assignees?.some((a) => a.agent_id === agent_id)).toBe(true)
  })

  test("should not include entries for unassigned tickets", async ({ fdm }) => {
    const assigneesMap = await getAssigneesForTicketsUnchecked(fdm, [ticket_id_1, ticket_id_2])

    expect(assigneesMap.has(ticket_id_2)).toBe(false)
  })

  test("should return an empty map when given an empty ticket_ids array", async ({ fdm }) => {
    const assigneesMap = await getAssigneesForTicketsUnchecked(fdm, [])

    expect(assigneesMap.size).toBe(0)
  })

  test("should throw when the database connection fails", async () => {
    const fdm = {
      select() {
        throw new Error("Database connection failed")
      },
    } as unknown as FdmHelpdeskType

    await expect(getAssigneesForTicketsUnchecked(fdm, ["some_ticket_id"])).rejects.toThrow(
      "Exception for getAssigneesForTicketsUnchecked",
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

  test("should return the correct ticket count per assignee", async ({ fdm }) => {
    const counts = await getTicketCountsForAssignees(fdm, admin_id, [admin_id, agent_id], {})

    expect(counts.get(admin_id)).toBe(2)
    expect(counts.get(agent_id)).toBe(1)
  })

  test("should not include agents with no assigned tickets", async ({ fdm }) => {
    const third_agent_id = createId()
    await addAgent(fdm, admin_id, third_agent_id, "Third Agent")

    const counts = await getTicketCountsForAssignees(fdm, admin_id, [third_agent_id], {})

    expect(counts.has(third_agent_id)).toBe(false)
  })

  test("should apply ticket filters when counting", async ({ fdm }) => {
    const tag_id = await createTag(fdm, admin_id, `CountTag${createId(8)}`, "#123456")
    await addTagToTicket(fdm, admin_id, ticket_id_1, tag_id)

    const counts = await getTicketCountsForAssignees(fdm, admin_id, [admin_id, agent_id], {
      tags: [tag_id],
    })

    expect(counts.get(admin_id)).toBe(1)
    expect(counts.has(agent_id)).toBe(false)
  })

  test("should count tickets correctly with multiple tags", async ({ fdm }) => {
    const tag_id = await createTag(fdm, admin_id, `CountTag${createId(8)}`, "#123456")
    const tag_id_2 = await createTag(fdm, admin_id, `CountTag${createId(8)}`, "#123456")
    await addTagToTicket(fdm, admin_id, ticket_id_1, tag_id)
    await addTagToTicket(fdm, admin_id, ticket_id_1, tag_id_2)

    const counts = await getTicketCountsForAssignees(fdm, admin_id, [admin_id, agent_id], {
      tags: [tag_id, tag_id_2],
    })

    expect(counts.get(admin_id)).toBe(1)
    expect(counts.has(agent_id)).toBe(false)
  })
})

describe("getAssignmentHistoryForTicket", () => {
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
    ticket_id = await createTicket(fdm, requester_id, "Ticket 1")

    await assignTicket(fdm, ticket_id, agent_id, admin_id, true)
    await assignTicket(fdm, ticket_id, admin_id, admin_id, true)
    await unassignTicket(fdm, ticket_id, agent_id, admin_id)
  })

  test("should throw when a regular user requests assignment history", async ({ fdm }) => {
    const other_user_id = createId()
    await expect(getAssignmentHistoryForTicket(fdm, other_user_id, ticket_id)).rejects.toThrow(
      "Principal does not have permission to perform this action",
    )
  })

  test("should return the assignment history for a ticket", async ({ fdm }) => {
    const history = await getAssignmentHistoryForTicket(fdm, admin_id, ticket_id)

    expect(history).toHaveLength(2)

    expect(history[0].agent_id).toBe(agent_id)
    expect(history[0].assigned_by).toBe(admin_id)
    expect(history[0].is_primary).toBe(false)
    expect(history[0].unassigned_at).not.toBeNull()
    expect(history[0].unassigned_by).toBe(admin_id)

    expect(history[1].agent_id).toBe(admin_id)
    expect(history[1].assigned_by).toBe(admin_id)
    expect(history[1].is_primary).toBe(true)
    expect(history[1].unassigned_at).toBeNull()
    expect(history[1].unassigned_by).toBeNull()
  })
})

describe("assignTicket", () => {
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
    ticket_id = await createTicket(fdm, requester_id, "Ticket 1")
  })

  test("should create a new assignment row if the previous ones are marked as unassigned", async ({
    fdm,
  }) => {
    await assignTicket(fdm, ticket_id, agent_id, admin_id, true)
    await unassignTicket(fdm, ticket_id, agent_id, admin_id)
    await assignTicket(fdm, ticket_id, agent_id, admin_id, false)

    const assignmentHistory = await getAssignmentHistoryForTicket(fdm, admin_id, ticket_id)
    expect(assignmentHistory).toHaveLength(2)
  })

  test("should update the existing assignment row if it exists", async ({ fdm }) => {
    await assignTicket(fdm, ticket_id, agent_id, admin_id, true)
    await assignTicket(fdm, ticket_id, agent_id, admin_id, false)

    const assignmentHistory = await getAssignmentHistoryForTicket(fdm, admin_id, ticket_id)
    expect(assignmentHistory).toHaveLength(1)
  })
})

describe("assignTicketUnchecked", () => {
  test("should throw when the database connection fails", async () => {
    const fdm = {
      select() {
        throw new Error("Database connection failed")
      },
    } as unknown as FdmHelpdeskType
    await expect(assignTicketUnchecked(fdm, createId(), createId(), createId())).rejects.toThrow(
      "Exception for assignTicketUnchecked",
    )
  })
})

describe("unassignTicket", () => {
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
    ticket_id = await createTicket(fdm, requester_id, "Ticket 1")
  })

  test("should return false when agent is not currently assigned", async ({ fdm }) => {
    const result = await unassignTicket(fdm, ticket_id, agent_id, admin_id)
    expect(result).toBe(false)
  })
})

describe("assignTicketToAnAdmin", () => {
  let requester_id: string
  let ticket_id: string

  // Truncate all tables before each test so every test starts with a clean, isolated database state.
  // This enables testing for the case where no admins exists and where only one or two admins exist.
  test.beforeEach(async ({ fdm }) => {
    await truncateAllTables(fdm)

    requester_id = createId()
    ticket_id = await createTicket(fdm, requester_id, "Ticket 1")
  })

  test("should assign to the admin if an admin is found", async ({ fdm }) => {
    const admin_id = createId()
    await addAdminAgent(fdm, admin_id, "Admin Agent")

    const agent_id = createId()
    await addAgent(fdm, admin_id, agent_id, "Regular Agent")

    expect(await assignTicketToAnAdmin(fdm, ticket_id)).toBe(admin_id)
  })

  test("should assign the ticket to the earliest created admin", async ({ fdm }) => {
    const admin_id_1 = createId()
    await addAdminAgent(fdm, admin_id_1, "Admin Agent 1")

    const admin_id_2 = createId()
    await addAgent(fdm, admin_id_1, admin_id_2, "Admin Agent 2")
    await updateAgentRole(fdm, admin_id_1, admin_id_2, "admin")

    expect(await assignTicketToAnAdmin(fdm, ticket_id)).toBe(admin_id_1)
  })

  test("should not assign and return null if the ticket is already assigned to a primary assignee", async ({
    fdm,
  }) => {
    const admin_id_1 = createId()
    await addAdminAgent(fdm, admin_id_1, "Admin Agent")

    const admin_id_2 = createId()
    await addAgent(fdm, admin_id_1, admin_id_2, "Regular Agent")
    await assignTicket(fdm, ticket_id, admin_id_2, admin_id_2, true)

    expect(await assignTicketToAnAdmin(fdm, ticket_id)).toBeNull()
  })

  test("should fail and return null if the ticket cannot be assigned to an admin", async ({
    fdm,
  }) => {
    expect(await assignTicketToAnAdmin(fdm, ticket_id)).toBeNull()
  })
})
