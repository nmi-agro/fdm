import { beforeEach, describe, expect, inject, it } from "vitest"
import type { FdmType } from "./fdm.types"
import { addAnimal } from "./animal"
import { addFarm } from "./farm"
import { createFdmServer } from "./fdm-server"
import { addFeedBatch, addFeeding, addFeedingAnimal, getFeedBatchesForFarm } from "./feed"
import { addHerd } from "./herd"

describe("Feed Domain", () => {
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
      "Test Farm for Feed",
      "123456",
      "Feed Road 1",
      "1234AB",
    )

    l_id_herd = await addHerd(fdm, principal_id, b_id_farm, {
      l_herd_name: "Melkkoeien",
      l_herd_category: "rvo_100",
    })
  })

  it("should create feed batch, list batches, record herd feeding, and record animal feeding", async () => {
    // Batch 1: Own land grass silage (450 g/kg DM)
    const f_id_batch_own = await addFeedBatch(
      fdm,
      principal_id,
      b_id_farm,
      "grass_silage",
      "own_land",
      {
        f_dm: 450,
        f_cp: 160,
      },
    )

    // Batch 2: Purchased maize silage (350 g/kg DM)
    const f_id_batch_purchased = await addFeedBatch(
      fdm,
      principal_id,
      b_id_farm,
      "maize_silage",
      "purchased",
      {
        f_dm: 350,
      },
    )

    const batches = await getFeedBatchesForFarm(fdm, principal_id, b_id_farm)
    expect(batches.length).toBe(2)

    const startDate = new Date("2025-07-01")

    // Herd feeding
    await addFeeding(fdm, principal_id, f_id_batch_own, l_id_herd, startDate, {
      f_amount: 10000,
    })

    // Animal supplemental feeding
    const l_id_animal = await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, { l_id_eartag: "NL101" })
    await addFeedingAnimal(fdm, principal_id, f_id_batch_purchased, l_id_animal, startDate, { f_amount: 50 })
  })

  it("should deny access to unauthorized principal", async () => {
    const invalidUser = "unauthorized_user"
    await expect(
      addFeedBatch(fdm, invalidUser, b_id_farm, "grass_silage", "own_land"),
    ).rejects.toThrowError("Principal does not have permission to perform this action")
  })
})
