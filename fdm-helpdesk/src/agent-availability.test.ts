import { eq, sql } from "drizzle-orm"
import { describe, expect } from "vitest"
import { addAdminAgent, addAgent, getAgent, setAgentActiveStatus } from "./agent"
import {
  cancelAbsence,
  getAbsence,
  getAbsencesForAgent,
  getAbsencesForAgentsOnDate,
  getAllAbsences,
  scheduleAbsence,
  updateAbsence,
  getAvailableAgents,
  setAssignmentTier,
  setMaxTickets,
  setWorkDays,
  autoAssignTicket,
  reassignAgentTickets,
} from "./agent-availability"
import * as schema from "./db/schema-helpdesk"
import { FdmHelpdeskType } from "./fdm-helpdesk.types"
import { createId } from "./id"
import { test, truncateAllTables } from "./test-util"
import { createTicket, getTicket, type Ticket } from "./ticket"
import { assignTicket } from "./ticket-assignment"

test.beforeEach(async ({ fdm }) => {
  await truncateAllTables(fdm)
})

describe("Agent availability CRUD", () => {
  let admin_id: string
  let agent_id: string
  let other_agent_id: string

  const DEFAULT_WORK_DAYS = [1, 2, 3, 4, 5]

  test.beforeEach(async ({ fdm }) => {
    admin_id = createId()
    await addAdminAgent(fdm, admin_id, "Admin Agent")

    agent_id = createId()
    await addAgent(fdm, admin_id, agent_id, "Support Agent")

    other_agent_id = createId()
    await addAgent(fdm, admin_id, other_agent_id, "Other Support Agent")
  })

  test("should set an agent's max number of tickets", async ({ fdm }) => {
    await setMaxTickets(fdm, admin_id, agent_id, 1)
    const agent = await getAgent(fdm, admin_id, agent_id)
    expect(agent.max_tickets).toEqual(1)
  })

  test("should not set a negative max number of tickets", async ({ fdm }) => {
    await expect(setMaxTickets(fdm, admin_id, agent_id, -1)).rejects.toThrow(
      "Exception for setMaxTickets",
    )
    const agent = await getAgent(fdm, admin_id, agent_id)
    expect(agent.max_tickets).toBeGreaterThanOrEqual(0)
  })

  test("should not let agents set each other's max number of tickets", async ({ fdm }) => {
    await expect(setMaxTickets(fdm, agent_id, admin_id, 1)).rejects.toThrow(
      "Principal does not have permission to perform this action",
    )
    const agent = await getAgent(fdm, admin_id, agent_id)
    expect(agent.max_tickets).not.toBe(1)
  })

  test("should set an agent's work days", async ({ fdm }) => {
    await setWorkDays(fdm, admin_id, agent_id, [1])
    const agent = await getAgent(fdm, admin_id, agent_id)
    expect(agent.work_days).toEqual([1])
  })

  test("should not let agents set each other's work days", async ({ fdm }) => {
    await expect(setWorkDays(fdm, agent_id, admin_id, [1])).rejects.toThrow(
      "Principal does not have permission to perform this action",
    )
    const agent = await getAgent(fdm, admin_id, agent_id)
    expect(agent.work_days).toEqual(DEFAULT_WORK_DAYS)
  })

  test("should not let setting work days to an empty array", async ({ fdm }) => {
    await expect(setWorkDays(fdm, agent_id, admin_id, [])).rejects.toThrow(
      "Exception for setWorkDays",
    )
  })

  test("should not let setting work days to an invalid object", async ({ fdm }) => {
    await expect(setWorkDays(fdm, agent_id, admin_id, {} as unknown as number[])).rejects.toThrow(
      "Exception for setWorkDays",
    )
    await expect(
      setWorkDays(fdm, agent_id, admin_id, ["hello"] as unknown as number[]),
    ).rejects.toThrow("Exception for setWorkDays")
    await expect(
      setWorkDays(fdm, agent_id, admin_id, false as unknown as number[]),
    ).rejects.toThrow("Exception for setWorkDays")
    await expect(setWorkDays(fdm, agent_id, admin_id, [Math.PI])).rejects.toThrow(
      "Exception for setWorkDays",
    )
    const agent = await getAgent(fdm, admin_id, agent_id)
    expect(agent.work_days).toEqual(DEFAULT_WORK_DAYS)
  })

  test("should not let setting a work day that is out of range", async ({ fdm }) => {
    await expect(setWorkDays(fdm, agent_id, admin_id, [7])).rejects.toThrow(
      "Exception for setWorkDays",
    )
  })

  test("should let an admin set an agent's assignment tier", async ({ fdm }) => {
    await setAssignmentTier(fdm, admin_id, agent_id, 3)
    const agent = await getAgent(fdm, admin_id, agent_id)
    expect(agent.assignment_tier).toEqual(3)
  })

  test("should not let regular agents set assignment tiers", async ({ fdm }) => {
    await expect(setAssignmentTier(fdm, agent_id, agent_id, 3)).rejects.toThrow(
      "Principal does not have permission to perform this action",
    )
    const agent = await getAgent(fdm, admin_id, agent_id)
    expect(agent.assignment_tier).toEqual(1)
  })

  test("should not let setting an invalid assignment tier", async ({ fdm }) => {
    await expect(
      setAssignmentTier(fdm, agent_id, agent_id, 4 as unknown as 1 | 2 | 3),
    ).rejects.toThrow("Exception for setAssignmentTier")
    const agent = await getAgent(fdm, admin_id, agent_id)
    expect(agent.assignment_tier).toEqual(1)
  })

  test("should not allow getting an absence that doesn't exist", async ({ fdm }) => {
    await expect(getAbsence(fdm, agent_id, createId())).rejects.toThrow(
      "Principal does not have permission to perform this action",
    )
  })

  test("should let an agent schedule their own absence", async ({ fdm }) => {
    const start_date = new Date("2025-01-01")
    const end_date = new Date("2025-01-05")
    await scheduleAbsence(fdm, agent_id, agent_id, start_date, end_date, "holiday", "Skiing")

    const absences = await getAbsencesForAgent(fdm, agent_id, agent_id)
    expect(absences).toHaveLength(1)
    expect(absences[0].reason).toBe("holiday")
    expect(absences[0].note).toBe("Skiing")
  })

  test("should not let an agent schedule another agent's absence", async ({ fdm }) => {
    await expect(
      scheduleAbsence(
        fdm,
        agent_id,
        other_agent_id,
        new Date("2025-01-01"),
        new Date("2025-01-05"),
        "holiday",
      ),
    ).rejects.toThrow("Principal does not have permission to perform this action")
  })

  test("should let an admin schedule another agent's absence", async ({ fdm }) => {
    await scheduleAbsence(
      fdm,
      admin_id,
      other_agent_id,
      new Date("2025-01-01"),
      new Date("2025-01-05"),
      "sick",
    )

    const absences = await getAbsencesForAgent(fdm, other_agent_id, other_agent_id)
    expect(absences).toHaveLength(1)
    expect(absences[0].reason).toBe("sick")
  })

  test("should not let schedule an absence with the end date to be before the start date", async ({
    fdm,
  }) => {
    await expect(
      scheduleAbsence(
        fdm,
        agent_id,
        agent_id,
        new Date("2025-01-05"),
        new Date("2025-01-01"),
        "holiday",
      ),
    ).rejects.toThrow("Exception for scheduleAbsence")
  })

  test("getAbsence should let the owner read their own absence", async ({ fdm }) => {
    await scheduleAbsence(
      fdm,
      agent_id,
      agent_id,
      new Date("2025-01-01"),
      new Date("2025-01-05"),
      "holiday",
    )
    const [created] = await getAbsencesForAgent(fdm, agent_id, agent_id)

    const absence = await getAbsence(fdm, agent_id, created.absence_id)
    expect(absence.absence_id).toBe(created.absence_id)
  })

  test("updateAbsence should let the owner update their own absence", async ({ fdm }) => {
    await scheduleAbsence(
      fdm,
      agent_id,
      agent_id,
      new Date("2025-01-01"),
      new Date("2025-01-05"),
      "holiday",
    )
    const [created] = await getAbsencesForAgent(fdm, agent_id, agent_id)

    await updateAbsence(fdm, agent_id, created.absence_id, {
      reason: "sick",
      note: "Feeling unwell",
    })

    const updated = await getAbsence(fdm, agent_id, created.absence_id)
    expect(updated.reason).toBe("sick")
    expect(updated.note).toBe("Feeling unwell")
  })

  test("updateAbsence should not let another agent update someone else's absence", async ({
    fdm,
  }) => {
    await scheduleAbsence(
      fdm,
      agent_id,
      agent_id,
      new Date("2025-01-01"),
      new Date("2025-01-05"),
      "holiday",
    )
    const [created] = await getAbsencesForAgent(fdm, agent_id, agent_id)

    await expect(
      updateAbsence(fdm, other_agent_id, created.absence_id, { reason: "other" }),
    ).rejects.toThrow("Principal does not have permission to perform this action")
  })

  test("updateAbsence should let an admin update any agent's absence", async ({ fdm }) => {
    await scheduleAbsence(
      fdm,
      agent_id,
      agent_id,
      new Date("2025-01-01"),
      new Date("2025-01-05"),
      "holiday",
    )
    const [created] = await getAbsencesForAgent(fdm, agent_id, agent_id)

    await updateAbsence(fdm, admin_id, created.absence_id, { reason: "other" })

    const updated = await getAbsence(fdm, admin_id, created.absence_id)
    expect(updated.reason).toBe("other")
  })

  test("updateAbsence should not let end date to be before start date", async ({ fdm }) => {
    await scheduleAbsence(
      fdm,
      agent_id,
      agent_id,
      new Date("2025-01-01"),
      new Date("2025-01-05"),
      "holiday",
    )
    const [created] = await getAbsencesForAgent(fdm, agent_id, agent_id)

    await expect(
      updateAbsence(fdm, admin_id, created.absence_id, {
        start_date: new Date("2025-01-06"),
        end_date: new Date("2025-01-05"),
      }),
    ).rejects.toThrow("Exception for updateAbsence")
  })

  test("cancelAbsence should let the owner cancel their own absence", async ({ fdm }) => {
    await scheduleAbsence(
      fdm,
      agent_id,
      agent_id,
      new Date("2025-01-01"),
      new Date("2025-01-05"),
      "holiday",
    )
    const [created] = await getAbsencesForAgent(fdm, agent_id, agent_id)

    await cancelAbsence(fdm, agent_id, created.absence_id)

    const absences = await getAbsencesForAgent(fdm, agent_id, agent_id)
    expect(absences).toHaveLength(0)
  })

  test("cancelAbsence should not let another regular agent cancel someone else's absence", async ({
    fdm,
  }) => {
    await scheduleAbsence(
      fdm,
      agent_id,
      agent_id,
      new Date("2025-01-01"),
      new Date("2025-01-05"),
      "holiday",
    )
    const [created] = await getAbsencesForAgent(fdm, agent_id, agent_id)

    await expect(cancelAbsence(fdm, other_agent_id, created.absence_id)).rejects.toThrow(
      "Principal does not have permission to perform this action",
    )
  })

  test("cancelAbsence should let an admin cancel any agent's absence", async ({ fdm }) => {
    await scheduleAbsence(
      fdm,
      agent_id,
      agent_id,
      new Date("2025-01-01"),
      new Date("2025-01-05"),
      "holiday",
    )
    const [created] = await getAbsencesForAgent(fdm, agent_id, agent_id)

    await cancelAbsence(fdm, admin_id, created.absence_id)

    const absences = await getAbsencesForAgent(fdm, agent_id, agent_id)
    expect(absences).toHaveLength(0)
  })

  test("getAllAbsences should return absences from every agent for any helpdesk agent", async ({
    fdm,
  }) => {
    await scheduleAbsence(
      fdm,
      agent_id,
      agent_id,
      new Date("2025-01-01"),
      new Date("2025-01-05"),
      "holiday",
    )
    await scheduleAbsence(
      fdm,
      admin_id,
      other_agent_id,
      new Date("2025-02-01"),
      new Date("2025-02-03"),
      "sick",
    )

    const all = await getAllAbsences(fdm, agent_id)
    expect(all).toHaveLength(2)
    const agentIds = all.map((a) => a.agent_id).sort()
    expect(agentIds).toEqual([agent_id, other_agent_id].sort())
    expect(all.find((a) => a.agent_id === agent_id)?.display_name).toBe("Support Agent")
  })

  test("getAllAbsences should not let regular users list agent absences", async ({ fdm }) => {
    await expect(getAllAbsences(fdm, createId())).rejects.toThrow(
      "Principal does not have permission to perform this action",
    )
  })

  test("getAbsencesForAgentsOnDate should return only absences active on the requested date", async ({
    fdm,
  }) => {
    await scheduleAbsence(
      fdm,
      agent_id,
      agent_id,
      new Date("2025-01-01"),
      new Date("2025-01-05"),
      "holiday",
    )
    await scheduleAbsence(
      fdm,
      admin_id,
      other_agent_id,
      new Date("2025-01-10"),
      new Date("2025-01-12"),
      "sick",
    )

    const absences = await getAbsencesForAgentsOnDate(fdm, agent_id, new Date("2025-01-03"))

    expect(absences.size).toBe(1)
    expect(absences.get(agent_id)?.reason).toBe("holiday")
    expect(absences.has(other_agent_id)).toBe(false)
  })

  test("getAbsencesForAgentsOnDate should keep the overlapping absence that ends latest per agent", async ({
    fdm,
  }) => {
    await scheduleAbsence(
      fdm,
      agent_id,
      agent_id,
      new Date("2025-01-01"),
      new Date("2025-01-05"),
      "holiday",
      "First",
    )
    await scheduleAbsence(
      fdm,
      agent_id,
      agent_id,
      new Date("2025-01-03"),
      new Date("2025-01-08"),
      "sick",
      "Second",
    )
    await scheduleAbsence(
      fdm,
      admin_id,
      other_agent_id,
      new Date("2025-01-03"),
      new Date("2025-01-04"),
      "training",
    )

    const absences = await getAbsencesForAgentsOnDate(fdm, agent_id, new Date("2025-01-04"))

    expect(absences.size).toBe(2)
    expect(absences.get(agent_id)?.reason).toBe("sick")
    expect(absences.get(agent_id)?.note).toBe("Second")
    expect(absences.get(agent_id)?.end_date).toEqual(new Date("2025-01-08"))
    expect(absences.get(other_agent_id)?.reason).toBe("training")
  })

  test("getAbsencesForAgentsOnDate should not let regular users list agent absences", async ({
    fdm,
  }) => {
    await expect(getAbsencesForAgentsOnDate(fdm, createId())).rejects.toThrow(
      "Principal does not have permission to perform this action",
    )
  })
})

describe("Agent availability", () => {
  let agent_id: string

  test.beforeEach(async ({ fdm }) => {
    agent_id = createId()
    await addAdminAgent(fdm, agent_id, "Test Admin Agent")
    await setWorkDays(fdm, agent_id, agent_id, [0, 1, 2, 3, 4, 5, 6])
  })

  test("should get an agent if they are available", async ({ fdm }) => {
    const available = await getAvailableAgents(fdm, new Date())
    expect(
      available.some((agent) => agent.agent_id === agent_id),
      "Newly created agent should have been listed as available.",
    ).toBe(true)
  })

  test("should not get an agent if they have too many tickets assigned", async ({ fdm }) => {
    await setMaxTickets(fdm, agent_id, agent_id, 1)
    const ticket_id = await createTicket(fdm, agent_id, "Ticket")
    await assignTicket(fdm, ticket_id, agent_id, agent_id, true)
    const available = await getAvailableAgents(fdm, new Date())
    expect(
      available.some((agent) => agent.agent_id === agent_id),
      "Agent with too many active tickets assigned should not have been listed as available.",
    ).toBe(false)
  })

  test("should not get an agent if they are not available on this day", async ({ fdm }) => {
    await setWorkDays(fdm, agent_id, agent_id, [0, 1, 2, 3, 4, 6])
    const date = new Date("2026-07-10T08:51:08.545Z") // Friday
    const available = await getAvailableAgents(fdm, date)
    expect(
      available.some((agent) => agent.agent_id === agent_id),
      "Agent who is not available on the day of the week should not have been listed as available.",
    ).toBe(false)
  })

  test("should not get an agent who is absent", async ({ fdm }) => {
    const absenceStart = new Date("2023-03-03T08:51:08.545Z")
    const absenceEnd = new Date("2023-03-05T23:59:59.999Z")
    const currentDate = new Date("2023-03-04T10:00:00.000Z")
    await scheduleAbsence(fdm, agent_id, agent_id, absenceStart, absenceEnd, "sick")
    const available = await getAvailableAgents(fdm, currentDate)
    expect(
      available.some((agent) => agent.agent_id === agent_id),
      "Agent who is absent should not have been listed as available.",
    ).toBe(false)
  })
})

describe("Agent prioritization", () => {
  let agent1_id: string
  let agent2_id: string

  test.beforeEach(async ({ fdm }) => {
    agent1_id = createId()
    await addAdminAgent(fdm, agent1_id, "Test Agent 1")
    await setWorkDays(fdm, agent1_id, agent1_id, [0, 1, 2, 3, 4, 5, 6])
    agent2_id = createId()
    await addAdminAgent(fdm, agent2_id, "Test Agent 2")
    await setWorkDays(fdm, agent2_id, agent2_id, [0, 1, 2, 3, 4, 5, 6])
  })

  test("should prioritize an agent with a low-priority assignment over one with a high-priority assignment", async ({
    fdm,
  }) => {
    const ticket_high_id = await createTicket(fdm, agent1_id, agent1_id, { priority: "high" })
    const ticket_normal_id = await createTicket(fdm, agent2_id, agent2_id, { priority: "normal" })
    await assignTicket(fdm, ticket_high_id, agent1_id, agent1_id, true)
    await assignTicket(fdm, ticket_normal_id, agent2_id, agent2_id, true)
    const available = await getAvailableAgents(fdm, new Date())
    const agent1_idx = available.findIndex((agent) => agent.agent_id === agent1_id)
    const agent2_idx = available.findIndex((agent) => agent.agent_id === agent2_id)
    expect(agent1_idx, "Agent 1 is available.").not.toBe(-1)
    expect(agent1_idx, "Agent 2 is available.").not.toBe(-1)
    expect(
      agent2_idx < agent1_idx,
      "Agent 2 has a lower priority ticket assigned than Agent 1.",
    ).toBe(true)
  })

  test("should prioritize an agent with fewer tickets assigned", async ({ fdm }) => {
    const ticket1_id = await createTicket(fdm, agent1_id, agent1_id)
    const ticket2_id = await createTicket(fdm, agent1_id, agent1_id)
    const ticket3_id = await createTicket(fdm, agent1_id, agent1_id)
    await assignTicket(fdm, ticket1_id, agent1_id, agent1_id, true)
    await assignTicket(fdm, ticket2_id, agent1_id, agent1_id, true)
    await assignTicket(fdm, ticket3_id, agent2_id, agent2_id, true)
    const available = await getAvailableAgents(fdm, new Date())
    const agent1_idx = available.findIndex((agent) => agent.agent_id === agent1_id)
    const agent2_idx = available.findIndex((agent) => agent.agent_id === agent2_id)
    expect(agent1_idx, "Agent 1 is available.").not.toBe(-1)
    expect(agent1_idx, "Agent 2 is available.").not.toBe(-1)
    expect(
      agent2_idx < agent1_idx,
      "Agent 2 has a lower priority ticket assigned than Agent 1.",
    ).toBe(true)
  })

  test("should prioritize an agent with a lower assignment tier", async ({ fdm }) => {
    await setAssignmentTier(fdm, agent1_id, agent1_id, 2)
    await setAssignmentTier(fdm, agent2_id, agent2_id, 1)
    const available = await getAvailableAgents(fdm, new Date())
    const agent1_idx = available.findIndex((agent) => agent.agent_id === agent1_id)
    const agent2_idx = available.findIndex((agent) => agent.agent_id === agent2_id)
    expect(agent1_idx, "Agent 1 is available.").not.toBe(-1)
    expect(agent1_idx, "Agent 2 is available.").not.toBe(-1)
    expect(agent2_idx < agent1_idx, "Agent 2 has a lower assignment tier than Agent 1.").toBe(true)
  })
})

describe("getAvailableAgents", () => {
  test("should throw when the database connection fails", async () => {
    const fdm = {
      select() {
        throw new Error("Database connection failed")
      },
    } as unknown as FdmHelpdeskType
    await expect(getAvailableAgents(fdm, new Date())).rejects.toThrow(
      "Exception for getAvailableAgents",
    )
  })
})

describe("autoAssignTicket", () => {
  let ticket_id: string

  test.beforeEach(async ({ fdm }) => {
    await truncateAllTables(fdm)
    ticket_id = await createTicket(fdm, createId(), "Ticket to Assign")
  })

  test("should assign when there is an available agent", async ({ fdm }) => {
    const agent_id = createId()
    await addAdminAgent(fdm, agent_id, "Available Agent")
    await setWorkDays(fdm, agent_id, agent_id, [0, 1, 2, 3, 4, 5, 6])
    const result = await autoAssignTicket(fdm, ticket_id, new Date())
    expect(result.assigned).toBe(true)
    expect(result.agent_id).toBe(agent_id)
    expect(result.display_name).toBe("Available Agent")
  })

  test("should fail to assign when there is no available agent", async ({ fdm }) => {
    const result = await autoAssignTicket(fdm, ticket_id, new Date())
    expect(result).toEqual({
      assigned: false,
      agent_id: undefined,
      agent: undefined,
    })
  })

  test("should throw when the database connection fails", async () => {
    const fdm = {
      select() {
        throw new Error("Database connection failed")
      },
    } as unknown as FdmHelpdeskType
    await expect(autoAssignTicket(fdm, ticket_id, new Date())).rejects.toThrow(
      "Exception for autoAssignTicket",
    )
  })
})

describe("reassignAgentTickets", () => {
  let ticket: Ticket
  let admin_id: string
  let departing_agent_id: string

  test.beforeEach(async ({ fdm }) => {
    await truncateAllTables(fdm)
    admin_id = createId()
    await addAdminAgent(fdm, admin_id, "Admin Agent")
    // Keep the admin out of the pool of auto-assignment candidates, so it doesn't shadow the
    // agents under test that we explicitly make available below.
    await fdm
      .update(schema.agents)
      .set({ work_days: [], updated: sql`now()` })
      .where(eq(schema.agents.agent_id, admin_id))
    departing_agent_id = createId()
    await addAgent(fdm, admin_id, departing_agent_id, "Leaving Agent")
    const ticket_id = await createTicket(fdm, createId(), "Ticket to Assign")
    await assignTicket(fdm, ticket_id, departing_agent_id, admin_id, true)
    // Capture the ticket (with its current assignee) as it looks right before reassignment,
    // matching the snapshot that reassignAgentTickets itself reads.
    ticket = await getTicket(fdm, admin_id, ticket_id)
    // Deactivating the departing agent must happen last, since they lose their permissions once inactive.
    await setAgentActiveStatus(fdm, admin_id, departing_agent_id, false)
  })

  test("should assign when there is an available agent", async ({ fdm }) => {
    const agent_id = await createId()
    await addAgent(fdm, admin_id, agent_id, "Available Agent")
    await setWorkDays(fdm, agent_id, agent_id, [0, 1, 2, 3, 4, 5, 6])
    const { reassigned } = await reassignAgentTickets(fdm, departing_agent_id, admin_id)
    expect(reassigned).toEqual([
      {
        ticket: ticket,
        agent_id: agent_id,
        display_name: "Available Agent",
        is_primary: true,
      },
    ])
  })

  test("should do nothing when there is another primary assignee", async ({ fdm }) => {
    const agent_id = await createId()
    await addAgent(fdm, admin_id, agent_id, "Available Agent")
    await assignTicket(fdm, ticket.ticket_id, agent_id, admin_id, true)
    await setWorkDays(fdm, agent_id, agent_id, [0, 1, 2, 3, 4, 5, 6])
    const { reassigned } = await reassignAgentTickets(fdm, departing_agent_id, admin_id)
    expect(reassigned).toEqual([])
  })

  test("should promote other assignee as primary when there is another non-primary assignee", async ({
    fdm,
  }) => {
    const agent_id = await createId()
    await addAgent(fdm, admin_id, agent_id, "Available Agent")
    await assignTicket(fdm, ticket.ticket_id, agent_id, admin_id, false)
    await setWorkDays(fdm, agent_id, agent_id, [0, 1, 2, 3, 4, 5, 6])
    const { reassigned } = await reassignAgentTickets(fdm, departing_agent_id, admin_id)
    const { assignees: _a, viewed_at: _va, ...baseTicket } = ticket
    expect(reassigned).toEqual([
      {
        ticket: baseTicket,
        agent_id: agent_id,
        display_name: "Available Agent",
        is_primary: true,
      },
    ])
  })

  test("should fail to assign when there is no available agent", async ({ fdm }) => {
    const { unassigned } = await reassignAgentTickets(fdm, departing_agent_id, admin_id)
    expect(unassigned).toEqual([ticket.ticket_id])
  })

  test("should throw when the database connection fails", async () => {
    const fdm = {
      select() {
        throw new Error("Database connection failed")
      },
    } as unknown as FdmHelpdeskType
    await expect(reassignAgentTickets(fdm, departing_agent_id, admin_id)).rejects.toThrow(
      "Exception for reassignAgentTickets",
    )
  })
})
