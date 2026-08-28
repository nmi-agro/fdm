import { beforeEach, describe, expect, inject, it } from "vitest"
import type { FdmType } from "./fdm.types"
import { addFarm } from "./farm"
import { createFdmServer } from "./fdm-server"
import {
  addFertilizerPlan,
  getFertilizerPlan,
  getFertilizerPlans,
  removeFertilizerPlan,
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
    expect(allPlans).toEqual(
      expect.arrayContaining([
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
      ]),
    )
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
    expect(yearPlans).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          p_id_plan: firstPlanId,
          p_plan_year: firstYear,
          p_plan_file_path: `plans/${firstYear}.pdf`,
          p_plan_hash: `hash-${firstYear}`,
          b_id_farm,
        }),
      ]),
    )
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
