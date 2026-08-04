import { beforeEach, describe, expect, inject, it } from "vitest"
import type { FdmType } from "./fdm.types"
import { addFarm } from "./farm"
import { createFdmServer } from "./fdm-server"
import { addFeedBatch, addFeeding, getFeedBatchesForFarm, getFeedSelfSufficiency } from "./feed"
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

  it("should create feed batch, list batches, record feeding, and compute self-sufficiency ratio", async () => {
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

    // Feed 10,000 kg fresh own grass silage (4,500 kg DM)
    await addFeeding(fdm, principal_id, f_id_batch_own, l_id_herd, startDate, {
      f_amount: 10000,
    })

    // Feed 5,000 kg fresh purchased maize silage (1,750 kg DM)
    await addFeeding(fdm, principal_id, f_id_batch_purchased, l_id_herd, startDate, {
      f_amount: 5000,
    })

    const selfSufficiency = await getFeedSelfSufficiency(fdm, principal_id, b_id_farm, {
      start: startDate,
      end: startDate,
    })

    // Total DM = 4500 + 1750 = 6250 kg DM
    // Own land DM = 4500 kg DM
    // Ratio = 4500 / 6250 = 0.72 (72%)
    expect(selfSufficiency.totalRoughageDmKg).toBe(6250)
    expect(selfSufficiency.ownLandRoughageDmKg).toBe(4500)
    expect(selfSufficiency.selfSufficiencyRatio).toBeCloseTo(0.72, 2)
  })

  it("should deny access to unauthorized principal", async () => {
    const invalidUser = "unauthorized_user"
    await expect(
      addFeedBatch(fdm, invalidUser, b_id_farm, "grass_silage", "own_land"),
    ).rejects.toThrowError("Principal does not have permission to perform this action")
  })
})
