import { beforeEach, describe, expect, inject, it } from "vitest"
import type { FdmType } from "./fdm.types"
import { grantRole } from "./authorization"
import { addFarm } from "./farm"
import { createFdmServer } from "./fdm-server"
import {
  addFertilizerPlan,
  getFertilizerPlan,
  getFertilizerPlans,
  removeFertilizerPlan,
  updateFertilizerPlanFilePath,
} from "./fertilizer-plan"
import { createId } from "./id"

describe("getFertilizerPlans", () => {
  let fdm: FdmType
  let principal_id: string
  let b_id_farm: string

  beforeEach(async () => {
    const host = inject("host")
    const port = inject("port")
    const user = inject("user")
    const password = inject("password")
    const database = inject("database")

    fdm = createFdmServer(host, port, user, password, database)
    principal_id = createId()
    b_id_farm = await addFarm(
      fdm,
      principal_id,
      "Test Farm for Fertilizer Plans",
      "123456",
      "Test Street 1",
      "1000",
    )
  })

  it("should return the fertilizer plans for a farm when the year is not specified", async () => {
    const firstYear = 2033 + Math.floor(Math.random() * 1000)
    const secondYear = firstYear + 1

    const firstPlanId = await addFertilizerPlan(
      fdm,
      principal_id,
      b_id_farm,
      firstYear,
      `plans/${firstYear}.pdf`,
      `hash-${firstYear}`,
      new Date("2024-01-15T00:00:00.000Z"),
    )

    const secondPlanId = await addFertilizerPlan(
      fdm,
      principal_id,
      b_id_farm,
      secondYear,
      `plans/${secondYear}.pdf`,
      `hash-${secondYear}`,
      new Date("2025-01-14T00:00:00.000Z"),
    )

    const allPlans = await getFertilizerPlans(fdm, principal_id, b_id_farm)
    expect(allPlans).toEqual([
      expect.objectContaining({
        p_id_plan: firstPlanId,
        p_plan_year: firstYear,
        p_plan_file_path: `plans/${firstYear}.pdf`,
        p_plan_hash: `hash-${firstYear}`,
        b_id_farm,
      }),
      expect.objectContaining({
        p_id_plan: secondPlanId,
        p_plan_year: secondYear,
        p_plan_file_path: `plans/${secondYear}.pdf`,
        p_plan_hash: `hash-${secondYear}`,
        b_id_farm,
      }),
    ])
  })

  it("should return the fertilizer plans for a farm when the year is specified", async () => {
    const firstYear = 2033 + Math.floor(Math.random() * 1000)
    const secondYear = firstYear + 1

    const firstPlanId = await addFertilizerPlan(
      fdm,
      principal_id,
      b_id_farm,
      firstYear,
      `plans/${firstYear}.pdf`,
      `hash-${firstYear}`,
      new Date("2024-01-15T00:00:00.000Z"),
    )

    await addFertilizerPlan(
      fdm,
      principal_id,
      b_id_farm,
      secondYear,
      `plans/${secondYear}.pdf`,
      `hash-${secondYear}`,
      new Date("2025-01-14T00:00:00.000Z"),
    )

    const yearPlans = await getFertilizerPlans(fdm, principal_id, b_id_farm, firstYear)
    expect(yearPlans).toEqual([
      expect.objectContaining({
        p_id_plan: firstPlanId,
        p_plan_year: firstYear,
        p_plan_file_path: `plans/${firstYear}.pdf`,
        p_plan_hash: `hash-${firstYear}`,
        b_id_farm,
      }),
    ])
  })

  it("should reject if the year is not an integer", async () => {
    await expect(getFertilizerPlans(fdm, principal_id, b_id_farm, 3.5)).rejects.toThrow(
      "Exception for getFertilizerPlans",
    )
  })

  it("should reject access for an unauthorized principal", async () => {
    await expect(getFertilizerPlans(fdm, "missing-principal", b_id_farm)).rejects.toThrow(
      "Principal does not have permission to perform this action",
    )
  })

  it("should return an empty array when no plan matches the requested year", async () => {
    const year = 2033 + Math.floor(Math.random() * 1000)
    await addFertilizerPlan(fdm, principal_id, b_id_farm, year, `plans/${year}.pdf`, `hash-${year}`)

    const plans = await getFertilizerPlans(fdm, principal_id, b_id_farm, year - 1)
    expect(plans).toEqual([])
  })
})

describe("getFertilizerPlan", () => {
  let fdm: FdmType
  let principal_id: string
  let b_id_farm: string

  beforeEach(async () => {
    const host = inject("host")
    const port = inject("port")
    const user = inject("user")
    const password = inject("password")
    const database = inject("database")

    fdm = createFdmServer(host, port, user, password, database)
    principal_id = createId()
    b_id_farm = await addFarm(
      fdm,
      principal_id,
      "Test Farm for Single Fertilizer Plan",
      "654321",
      "Test Street 2",
      "2000",
    )
  })

  it("should return the stored fertilizer plan including farm details", async () => {
    const p_id_plan = await addFertilizerPlan(
      fdm,
      principal_id,
      b_id_farm,
      2026,
      "plans/single.pdf",
      "single-hash",
      new Date("2026-02-01T00:00:00.000Z"),
    )

    const plan = await getFertilizerPlan(fdm, principal_id, p_id_plan)
    expect(plan).toEqual(
      expect.objectContaining({
        p_id_plan,
        p_plan_year: 2026,
        p_plan_file_path: "plans/single.pdf",
        p_plan_hash: "single-hash",
        b_id_farm,
      }),
    )
  })

  it("should reject access if the fertilizer plan is not found", async () => {
    await expect(getFertilizerPlan(fdm, principal_id, "unknown-plan")).rejects.toThrow(
      "Principal does not have permission to perform this action",
    )
  })

  it("should reject access for an unauthorized principal", async () => {
    const p_id_plan = await addFertilizerPlan(
      fdm,
      principal_id,
      b_id_farm,
      2027,
      "plans/restricted.pdf",
      "restricted-hash",
    )

    await expect(getFertilizerPlan(fdm, "missing-principal", p_id_plan)).rejects.toThrow(
      "Principal does not have permission to perform this action",
    )
  })
})

describe("addFertilizerPlan", () => {
  let fdm: FdmType
  let principal_id: string
  let b_id_farm: string

  beforeEach(async () => {
    const host = inject("host")
    const port = inject("port")
    const user = inject("user")
    const password = inject("password")
    const database = inject("database")

    fdm = createFdmServer(host, port, user, password, database)
    principal_id = createId()
    b_id_farm = await addFarm(
      fdm,
      principal_id,
      "Test Farm for Adding Fertilizer Plan",
      "987654",
      "Test Street 3",
      "3000",
    )
  })

  it("should add a fertilizer plan and store it for the farm", async () => {
    const p_id_plan = await addFertilizerPlan(
      fdm,
      principal_id,
      b_id_farm,
      2028,
      "plans/added.pdf",
      "added-hash",
      new Date("2028-03-10T00:00:00.000Z"),
    )

    const plan = await getFertilizerPlan(fdm, principal_id, p_id_plan)
    expect(plan).toEqual(
      expect.objectContaining({
        p_id_plan,
        p_plan_year: 2028,
        p_plan_file_path: "plans/added.pdf",
        p_plan_hash: "added-hash",
        b_id_farm,
      }),
    )
  })

  it("should reject access for an unauthorized principal", async () => {
    await expect(
      addFertilizerPlan(
        fdm,
        "missing-principal",
        b_id_farm,
        2029,
        "plans/unauthorized.pdf",
        "unauthorized-hash",
      ),
    ).rejects.toThrow("Principal does not have permission to perform this action")
  })
})

describe("updateFertilizerPlanFilePath", () => {
  let fdm: FdmType
  let principal_id: string
  let b_id_farm: string

  beforeEach(async () => {
    const host = inject("host")
    const port = inject("port")
    const user = inject("user")
    const password = inject("password")
    const database = inject("database")

    fdm = createFdmServer(host, port, user, password, database)
    principal_id = createId()
    b_id_farm = await addFarm(
      fdm,
      principal_id,
      "Test Farm for Updating Fertilizer Plan",
      "222222",
      "Test Street 5",
      "5000",
    )
  })

  it("should update the file path of an existing fertilizer plan", async () => {
    const p_id_plan = await addFertilizerPlan(
      fdm,
      principal_id,
      b_id_farm,
      2035,
      "plans/original.pdf",
      "original-hash",
    )

    await updateFertilizerPlanFilePath(fdm, principal_id, p_id_plan, "plans/updated.pdf")

    const plan = await getFertilizerPlan(fdm, principal_id, p_id_plan)
    expect(plan).toEqual(
      expect.objectContaining({
        p_id_plan,
        p_plan_file_path: "plans/updated.pdf",
        p_plan_hash: "original-hash",
      }),
    )
  })

  it("should reject access if the fertilizer plan is not found", async () => {
    await expect(
      updateFertilizerPlanFilePath(fdm, principal_id, "unknown-plan", "plans/updated.pdf"),
    ).rejects.toThrow("Principal does not have permission to perform this action")
  })

  it("should reject access for an unauthorized principal", async () => {
    const p_id_plan = await addFertilizerPlan(
      fdm,
      principal_id,
      b_id_farm,
      2036,
      "plans/forbidden.pdf",
      "forbidden-hash",
    )

    await expect(
      updateFertilizerPlanFilePath(fdm, "missing-principal", p_id_plan, "plans/updated.pdf"),
    ).rejects.toThrow("Principal does not have permission to perform this action")
  })
})

describe("removeFertilizerPlan", () => {
  let fdm: FdmType
  let principal_id: string
  let b_id_farm: string

  beforeEach(async () => {
    const host = inject("host")
    const port = inject("port")
    const user = inject("user")
    const password = inject("password")
    const database = inject("database")

    fdm = createFdmServer(host, port, user, password, database)
    principal_id = createId()
    b_id_farm = await addFarm(
      fdm,
      principal_id,
      "Test Farm for Removing Fertilizer Plan",
      "111111",
      "Test Street 4",
      "4000",
    )
  })

  it("should remove an existing fertilizer plan", async () => {
    const year = 2130 + Math.floor(Math.random() * 1000)
    const p_id_plan = await addFertilizerPlan(
      fdm,
      principal_id,
      b_id_farm,
      year,
      "plans/to-remove.pdf",
      "remove-hash",
      new Date("2030-04-12T00:00:00.000Z"),
    )

    await removeFertilizerPlan(fdm, principal_id, p_id_plan)

    const remainingPlans = await getFertilizerPlans(fdm, principal_id, b_id_farm)
    expect(remainingPlans.some((plan) => plan.p_id_plan === p_id_plan)).toBe(false)
    await expect(getFertilizerPlan(fdm, principal_id, p_id_plan)).rejects.toThrow(
      "Principal does not have permission to perform this action",
    )
  })

  it("should reject access if the fertilizer plan is not found", async () => {
    await expect(removeFertilizerPlan(fdm, principal_id, "unknown-plan")).rejects.toThrow(
      "Principal does not have permission to perform this action",
    )
  })

  it("should reject access for an unauthorized principal", async () => {
    const p_id_plan = await addFertilizerPlan(
      fdm,
      principal_id,
      b_id_farm,
      2031,
      "plans/forbidden.pdf",
      "forbidden-hash",
    )

    await expect(removeFertilizerPlan(fdm, "missing-principal", p_id_plan)).rejects.toThrow(
      "Principal does not have permission to perform this action",
    )
  })
})

describe("fertilizer_plan authorization roles", () => {
  let fdm: FdmType
  let ownerId: string
  let b_id_farm: string
  let p_id_plan: string

  beforeEach(async () => {
    const host = inject("host")
    const port = inject("port")
    const user = inject("user")
    const password = inject("password")
    const database = inject("database")

    fdm = createFdmServer(host, port, user, password, database)
    ownerId = createId()
    b_id_farm = await addFarm(
      fdm,
      ownerId,
      "Test Farm for Fertilizer Plan Roles",
      "333333",
      "Test Street 6",
      "6000",
    )
    p_id_plan = await addFertilizerPlan(
      fdm,
      ownerId,
      b_id_farm,
      2040,
      "plans/roles.pdf",
      "roles-hash",
    )
  })

  it("should allow a farm owner to read, write, remove, and share the fertilizer plans", async () => {
    const advisorId = createId()
    await grantRole(fdm, "farm", "owner", b_id_farm, advisorId)

    await expect(getFertilizerPlans(fdm, advisorId, b_id_farm)).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ p_id_plan })]),
    )
    await expect(getFertilizerPlan(fdm, advisorId, p_id_plan)).resolves.toEqual(
      expect.objectContaining({ p_id_plan }),
    )

    const newPlanId = await addFertilizerPlan(
      fdm,
      advisorId,
      b_id_farm,
      2041,
      "plans/owner-added.pdf",
      "owner-added-hash",
    )
    expect(newPlanId).toBeTruthy()

    await updateFertilizerPlanFilePath(fdm, advisorId, p_id_plan, "plans/owner-updated.pdf")
    const updatedPlan = await getFertilizerPlan(fdm, advisorId, p_id_plan)
    expect(updatedPlan.p_plan_file_path).toBe("plans/owner-updated.pdf")

    await removeFertilizerPlan(fdm, advisorId, p_id_plan)
    await expect(getFertilizerPlan(fdm, advisorId, p_id_plan)).rejects.toThrow(
      "Principal does not have permission to perform this action",
    )
  })

  it("should allow a farm advisor to read, write, and remove fertilizer plans", async () => {
    const advisorId = createId()
    await grantRole(fdm, "farm", "advisor", b_id_farm, advisorId)

    await expect(getFertilizerPlans(fdm, advisorId, b_id_farm)).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ p_id_plan })]),
    )
    await expect(getFertilizerPlan(fdm, advisorId, p_id_plan)).resolves.toEqual(
      expect.objectContaining({ p_id_plan }),
    )

    const newPlanId = await addFertilizerPlan(
      fdm,
      advisorId,
      b_id_farm,
      2041,
      "plans/advisor-added.pdf",
      "advisor-added-hash",
    )
    expect(newPlanId).toBeTruthy()

    await updateFertilizerPlanFilePath(fdm, advisorId, p_id_plan, "plans/advisor-updated.pdf")
    const updatedPlan = await getFertilizerPlan(fdm, advisorId, p_id_plan)
    expect(updatedPlan.p_plan_file_path).toBe("plans/advisor-updated.pdf")

    await removeFertilizerPlan(fdm, advisorId, p_id_plan)
    await expect(getFertilizerPlan(fdm, advisorId, p_id_plan)).rejects.toThrow(
      "Principal does not have permission to perform this action",
    )
  })

  it("should allow a farm researcher to only read fertilizer plans", async () => {
    const researcherId = createId()
    await grantRole(fdm, "farm", "researcher", b_id_farm, researcherId)

    await expect(getFertilizerPlans(fdm, researcherId, b_id_farm)).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ p_id_plan })]),
    )
    await expect(getFertilizerPlan(fdm, researcherId, p_id_plan)).resolves.toEqual(
      expect.objectContaining({ p_id_plan }),
    )

    await expect(
      addFertilizerPlan(
        fdm,
        researcherId,
        b_id_farm,
        2042,
        "plans/researcher-added.pdf",
        "researcher-added-hash",
      ),
    ).rejects.toThrow("Principal does not have permission to perform this action")

    await expect(
      updateFertilizerPlanFilePath(fdm, researcherId, p_id_plan, "plans/researcher-updated.pdf"),
    ).rejects.toThrow("Principal does not have permission to perform this action")

    await expect(removeFertilizerPlan(fdm, researcherId, p_id_plan)).rejects.toThrow(
      "Principal does not have permission to perform this action",
    )
  })

  it("should reject a principal with no role at all on every operation", async () => {
    await expect(getFertilizerPlans(fdm, "missing-principal", b_id_farm)).rejects.toThrow(
      "Principal does not have permission to perform this action",
    )
    await expect(getFertilizerPlan(fdm, "missing-principal", p_id_plan)).rejects.toThrow(
      "Principal does not have permission to perform this action",
    )
    await expect(
      addFertilizerPlan(
        fdm,
        "missing-principal",
        b_id_farm,
        2043,
        "plans/stranger.pdf",
        "stranger-hash",
      ),
    ).rejects.toThrow("Principal does not have permission to perform this action")
    await expect(
      updateFertilizerPlanFilePath(
        fdm,
        "missing-principal",
        p_id_plan,
        "plans/stranger-updated.pdf",
      ),
    ).rejects.toThrow("Principal does not have permission to perform this action")
    await expect(removeFertilizerPlan(fdm, "missing-principal", p_id_plan)).rejects.toThrow(
      "Principal does not have permission to perform this action",
    )
  })
})
