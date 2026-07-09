import { describe, expect } from "vitest"
import { addAdminAgent, addAgent } from "./agent"
import {
  cancelAbsence,
  getAbsence,
  getAgentAbsences,
  getAllAbsences,
  scheduleAbsence,
  updateAbsence,
} from "./agent-availability"
import { createId } from "./id"
import { test, truncateAllTables } from "./test-util"

test.beforeEach(async ({ fdm }) => {
  await truncateAllTables(fdm)
})

describe("Agent absences", () => {
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
})
