import { describe, expect } from "vitest"
import { addAdminAgent, addAgent, setAgentActiveStatus } from "./agent"
import {
  cancelAbsence,
  getAbsence,
  getAgentAbsences,
  getAbsencesForAgents,
  getAllAbsences,
  scheduleAbsence,
  updateAbsence,
  getAvailableAgents,
  setMaxTickets,
  setWorkDays,
  setAgentStatus,
  autoAssignTicket,
  reassignAgentTickets,
} from "./agent-availability"
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

  test.beforeEach(async ({ fdm }) => {
    admin_id = createId()
    await addAdminAgent(fdm, admin_id, "Admin Agent")

    agent_id = createId()
    await addAgent(fdm, admin_id, agent_id, "Support Agent")

    other_agent_id = createId()
    await addAgent(fdm, admin_id, other_agent_id, "Other Support Agent")
  })

  test("should let an agent schedule their own absence", async ({ fdm }) => {
    const start_date = new Date("2025-01-01")
    const end_date = new Date("2025-01-05")
    await scheduleAbsence(fdm, agent_id, agent_id, start_date, end_date, "holiday", "Skiing")

    const absences = await getAgentAbsences(fdm, agent_id)
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

    const absences = await getAgentAbsences(fdm, other_agent_id)
    expect(absences).toHaveLength(1)
    expect(absences[0].reason).toBe("sick")
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
    const [created] = await getAgentAbsences(fdm, agent_id)

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
    const [created] = await getAgentAbsences(fdm, agent_id)

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
    const [created] = await getAgentAbsences(fdm, agent_id)

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
    const [created] = await getAgentAbsences(fdm, agent_id)

    await updateAbsence(fdm, admin_id, created.absence_id, { reason: "other" })

    const updated = await getAbsence(fdm, admin_id, created.absence_id)
    expect(updated.reason).toBe("other")
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
    const [created] = await getAgentAbsences(fdm, agent_id)

    await cancelAbsence(fdm, agent_id, created.absence_id)

    const absences = await getAgentAbsences(fdm, agent_id)
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
    const [created] = await getAgentAbsences(fdm, agent_id)

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
    const [created] = await getAgentAbsences(fdm, agent_id)

    await cancelAbsence(fdm, admin_id, created.absence_id)

    const absences = await getAgentAbsences(fdm, agent_id)
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

  test("getAbsencesForAgents should return only absences active on the requested date", async ({
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

    const absences = await getAbsencesForAgents(fdm, new Date("2025-01-03"))

    expect(absences.size).toBe(1)
    expect(absences.get(agent_id)?.reason).toBe("holiday")
    expect(absences.has(other_agent_id)).toBe(false)
  })

  test("getAbsencesForAgents should keep the overlapping absence that ends latest per agent", async ({
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

    const absences = await getAbsencesForAgents(fdm, new Date("2025-01-04"))

    expect(absences.size).toBe(2)
    expect(absences.get(agent_id)?.reason).toBe("sick")
    expect(absences.get(agent_id)?.note).toBe("Second")
    expect(absences.get(agent_id)?.end_date).toEqual(new Date("2025-01-08"))
    expect(absences.get(other_agent_id)?.reason).toBe("training")
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

  test("should not get an agent who is not online", async ({ fdm }) => {
    await setAgentStatus(fdm, agent_id, agent_id, "out-of-office")
    const available = await getAvailableAgents(fdm, new Date())
    expect(
      available.some((agent) => agent.agent_id === agent_id),
      "Agent who is out of the office should not have been listed as available.",
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
    await setAgentStatus(fdm, admin_id, admin_id, "out-of-office")
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
        availability_status: "online",
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
