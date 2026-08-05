import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, inject, it } from "vitest"
import type { FdmType } from "./fdm.types"
import { checkPermission } from "./authorization"
import * as schema from "./db/schema"
import { addFarm } from "./farm"
import { createFdmServer } from "./fdm-server"
import { addHerd } from "./herd"
import { createId } from "./id"
import { addExcreting, addManureDisposing, addManurePit, getManureDisposalsForFarm } from "./manure"

describe("Manure Domain", () => {
  let fdm: FdmType
  let principal_id: string
  let b_id_farm: string
  let l_id_herd: string

  beforeEach(async () => {
    const host = inject("host")
    const port = inject("port")
    const user = inject("user")
    const password = inject("password")
    const database = inject("database")
    fdm = createFdmServer(host, port, user, password, database)
    principal_id = "test_principal"

    b_id_farm = await addFarm(
      fdm,
      principal_id,
      "Test Farm for Manure",
      "123456",
      "Manure Lane 1",
      "1234AB",
    )

    l_id_herd = await addHerd(fdm, principal_id, b_id_farm, {
      l_herd_name: "Melkkoeien",
      l_herd_category: "rvo_100",
    })
  })

  it("should create manure pit, record excreting, and record manure export delivery", async () => {
    const b_id_manurepit = await addManurePit(fdm, principal_id, b_id_farm, {
      b_manurepit_name: "Mestkelder 1",
      b_pit_area: 300,
    })
    expect(b_id_manurepit).toBeDefined()

    const l_id_excreting = await addExcreting(fdm, principal_id, l_id_herd, b_id_manurepit, {
      p_excreting_amount: 25000,
    })
    expect(l_id_excreting).toBeDefined()

    const discardDate = new Date("2025-04-10")
    const p_id_delivery = await addManureDisposing(
      fdm,
      principal_id,
      b_id_manurepit,
      discardDate,
      10000,
      {
        p_n_rt: 4.2,
        p_p_rt: 1.8,
        p_dm: 85,
      },
    )

    expect(p_id_delivery).toBeDefined()

    const deliveries = await getManureDisposalsForFarm(fdm, principal_id, b_id_farm)
    expect(deliveries.length).toBe(1)
    expect(deliveries[0].p_id_delivery).toBe(p_id_delivery)
    expect(deliveries[0].p_disposing_amount).toBe(10000)
    expect(deliveries[0].p_n_rt).toBe(4.2)
  })

  it("should link own manure pit to acquired fertilizer via b_id_manurepit FK on fertilizer_acquiring", async () => {
    const b_id_manurepit = await addManurePit(fdm, principal_id, b_id_farm)
    await checkPermission(fdm, "farm", "write", b_id_farm, principal_id, "fertilizerAcquiringTest")

    const p_id = createId()

    await fdm.transaction(async (tx) => {
      await tx.insert(schema.fertilizers).values({ p_id })
      await tx.insert(schema.fertilizerAcquiring).values({
        b_id_farm,
        p_id,
        p_acquiring_amount: 15000,
        p_acquiring_date: new Date("2025-03-15"),
        b_id_manurepit,
      })
    })

    const acquired = await fdm
      .select({
        b_id_farm: schema.fertilizerAcquiring.b_id_farm,
        p_id: schema.fertilizerAcquiring.p_id,
        b_id_manurepit: schema.fertilizerAcquiring.b_id_manurepit,
      })
      .from(schema.fertilizerAcquiring)
      .where(eq(schema.fertilizerAcquiring.p_id, p_id))

    expect(acquired.length).toBe(1)
    expect(acquired[0].b_id_manurepit).toBe(b_id_manurepit)
  })

  it("should record excreting with end date, filter disposals by timeframe, and handle 0 pits", async () => {
    const b_id_manurepit = await addManurePit(fdm, principal_id, b_id_farm)
    const startDate = new Date("2025-04-01")
    const endDate = new Date("2025-04-30")

    const l_id_excreting = await addExcreting(fdm, principal_id, l_id_herd, b_id_manurepit, {
      l_excreting_start: startDate,
      l_excreting_end: endDate,
      p_excreting_amount: 12000,
    })
    expect(l_id_excreting).toBeDefined()

    const d1 = new Date("2025-04-10")
    const d2 = new Date("2025-05-10")
    await addManureDisposing(fdm, principal_id, b_id_manurepit, d1, 5000)
    await addManureDisposing(fdm, principal_id, b_id_manurepit, d2, 7000)

    const startOnly = await getManureDisposalsForFarm(fdm, principal_id, b_id_farm, {
      start: new Date("2025-05-01"),
      end: undefined,
    })
    expect(startOnly.length).toBe(1)
    expect(startOnly[0].p_disposing_amount).toBe(7000)

    const endOnly = await getManureDisposalsForFarm(fdm, principal_id, b_id_farm, {
      start: undefined,
      end: new Date("2025-05-01"),
    })
    expect(endOnly.length).toBe(1)
    expect(endOnly[0].p_disposing_amount).toBe(5000)

    // Farm with 0 pits
    const farm2 = await addFarm(fdm, principal_id, "Farm 2", "654321", "Street 2", "1234AB")
    const emptyDisposals = await getManureDisposalsForFarm(fdm, principal_id, farm2)
    expect(emptyDisposals).toEqual([])
  })

  it("should throw an error when adding excreting with a non-existent manure pit", async () => {
    const countBefore = await fdm
      .select()
      .from(schema.excreting)
      .where(eq(schema.excreting.l_id_herd, l_id_herd))

    await expect(
      addExcreting(fdm, principal_id, l_id_herd, "non_existent_pit_id", {
        p_excreting_amount: 1000,
      }),
    ).rejects.toThrowError("Exception for addExcreting")

    const countAfter = await fdm
      .select()
      .from(schema.excreting)
      .where(eq(schema.excreting.l_id_herd, l_id_herd))
    expect(countAfter.length).toBe(countBefore.length)
  })

  it("should deny access to unauthorized principal", async () => {
    const invalidUser = "unauthorized_user"
    await expect(addManurePit(fdm, invalidUser, b_id_farm)).rejects.toThrowError(
      "Principal does not have permission to perform this action",
    )
  })

  it("should deny access to unauthorized principal for remaining manure functions", async () => {
    const b_id_manurepit = await addManurePit(fdm, principal_id, b_id_farm)
    const invalidUser = "unauthorized_user"

    await expect(
      addExcreting(fdm, invalidUser, l_id_herd, b_id_manurepit),
    ).rejects.toThrowError("Principal does not have permission to perform this action")

    await expect(
      addManureDisposing(fdm, invalidUser, b_id_manurepit, new Date(), 1000),
    ).rejects.toThrowError("Principal does not have permission to perform this action")

    await expect(
      getManureDisposalsForFarm(fdm, invalidUser, b_id_farm),
    ).rejects.toThrowError("Principal does not have permission to perform this action")
  })
})
