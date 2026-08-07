import { beforeEach, describe, expect, inject, it } from "vitest"
import { getAnimalCategoriesCatalogue, getFeedCatalogue } from "@nmi-agro/fdm-data"
import type { FdmType } from "./fdm.types"
import type { Feeding } from "./feed.types"
import { addAnimal, assignAnimalToHerd } from "./animal"
import {
  enableFeedCatalogue,
  syncAnimalCategoryCatalogueArray,
  syncFeedCatalogueArray,
} from "./catalogues"
import { addFarm } from "./farm"
import { createFdmServer } from "./fdm-server"
import {
  addFeedBatch,
  addFeedToCatalogue,
  addFeedingAnimal,
  addFeedingHerd,
  getFeedingEventsForAnimal,
  getFeedingSummaryForAnimal,
  getFeedBatch,
  getFeedBatchesForFarm,
  getFeedsFromCatalogue,
  getFeedingAnimalForFarm,
  getFeedingHerdForFarm,
  removeFeedBatch,
  removeFeedingAnimal,
  removeFeedingHerd,
  updateFeedBatch,
  updateFeedingAnimal,
  updateFeedingHerd,
} from "./feed"
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
    await syncAnimalCategoryCatalogueArray(fdm, await getAnimalCategoriesCatalogue("rvo"))
    await syncFeedCatalogueArray(fdm, await getFeedCatalogue("nmi"))
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
      l_id_category: "rvo_100",
    })
  })

  it("supports farm-specific feed catalogue entries", async () => {
    const f_id_catalogue = await addFeedToCatalogue(fdm, principal_id, b_id_farm, {
      f_name_nl: "Eigen krachtvoer",
      f_type_rvo: "custom_feed",
      f_dm: 900,
      f_n_dm: 25,
      f_p_dm: 7,
    })
    await enableFeedCatalogue(fdm, principal_id, b_id_farm, b_id_farm)

    const feeds = await getFeedsFromCatalogue(fdm, principal_id, b_id_farm)
    expect(feeds.find((feed) => feed.f_id_catalogue === f_id_catalogue)).toMatchObject({
      f_source: b_id_farm,
      f_name_nl: "Eigen krachtvoer",
    })
  })

  it("should create feed batch, list batches, record herd feeding, and record animal feeding", async () => {
    // Batch 1: Own land grass silage (450 g/kg DM)
    const f_id_batch_own = await addFeedBatch(
      fdm,
      principal_id,
      b_id_farm,
      "nmi_016",
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
      "nmi_001",
      "purchased",
      {
        f_dm: 350,
      },
    )

    const batches = await getFeedBatchesForFarm(fdm, principal_id, b_id_farm)
    expect(batches.length).toBe(2)

    const startDate = new Date("2025-07-01")

    // Herd feeding
    await addFeedingHerd(fdm, principal_id, f_id_batch_own, l_id_herd, startDate, {
      f_amount: 10000,
    })

    // Animal supplemental feeding
    const l_id_animal = await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
      l_id_eartag: "NL101",
    })
    await addFeedingAnimal(fdm, principal_id, f_id_batch_purchased, l_id_animal, startDate, {
      f_amount: 50,
    })
  })

  it("should update and remove feed batches and feeding records via farm-scoped helpers", async () => {
    const f_id_batch = await addFeedBatch(fdm, principal_id, b_id_farm, "nmi_016", "own_land", {
      f_batch_name: "Batch 1",
      f_dm: 420,
      f_cp: 150,
      f_sampling_date: new Date("2025-07-01"),
    })
    const l_id_animal = await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
      l_id_eartag: "NL303",
    })
    const feedingStart = new Date("2025-07-10")

    await addFeedingHerd(fdm, principal_id, f_id_batch, l_id_herd, feedingStart, {
      f_amount: 2500,
    })
    await addFeedingAnimal(fdm, principal_id, f_id_batch, l_id_animal, feedingStart, {
      f_amount: 45,
    })

    const batch = await getFeedBatch(fdm, principal_id, f_id_batch)
    expect(batch.f_batch_name).toBe("Batch 1")
    expect(batch.f_dm).toBe(420)

    const correctedSampling = new Date("2025-07-15")
    await updateFeedBatch(fdm, principal_id, f_id_batch, {
      f_batch_name: "Batch 1 corrected",
      f_id_catalogue: "nmi_001",
      f_batch_origin: "purchased",
      f_dm: 440,
      f_cp: 155,
      f_sampling_date: correctedSampling,
    })
    const updatedBatch = await getFeedBatch(fdm, principal_id, f_id_batch)
    expect(updatedBatch.f_batch_name).toBe("Batch 1 corrected")
    expect(updatedBatch.f_id_catalogue).toBe("nmi_001")
    expect(updatedBatch.f_batch_origin).toBe("purchased")
    expect(updatedBatch.f_dm).toBe(440)
    expect(updatedBatch.f_cp).toBe(155)
    expect(updatedBatch.f_sampling_date?.toISOString()).toBe(correctedSampling.toISOString())

    expect((await getFeedingHerdForFarm(fdm, principal_id, b_id_farm)).length).toBe(1)
    expect((await getFeedingAnimalForFarm(fdm, principal_id, b_id_farm)).length).toBe(1)

    await updateFeedingHerd(fdm, principal_id, f_id_batch, l_id_herd, feedingStart, {
      f_amount: 2800,
    })
    expect((await getFeedingHerdForFarm(fdm, principal_id, b_id_farm))[0].f_amount).toBe(2800)

    await updateFeedingAnimal(fdm, principal_id, l_id_animal, f_id_batch, feedingStart, {
      f_amount: 50,
    })
    expect((await getFeedingAnimalForFarm(fdm, principal_id, b_id_farm))[0].f_amount).toBe(50)

    await removeFeedingHerd(fdm, principal_id, f_id_batch, l_id_herd, feedingStart)
    await removeFeedingAnimal(fdm, principal_id, l_id_animal, f_id_batch, feedingStart)

    await removeFeedBatch(fdm, principal_id, f_id_batch)
    expect(await getFeedBatchesForFarm(fdm, principal_id, b_id_farm)).toEqual([])
  })

  it("should allow farm-wide Feeding union arrays from herd and animal records", async () => {
    const f_id_batch = await addFeedBatch(fdm, principal_id, b_id_farm, "nmi_016", "own_land")
    const l_id_animal = await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
      l_id_eartag: "NL-FEED-UNION-1",
    })
    const start = new Date("2025-07-11T00:00:00.000Z")

    await addFeedingHerd(fdm, principal_id, f_id_batch, l_id_herd, start, { f_amount: 1100 })
    await addFeedingAnimal(fdm, principal_id, f_id_batch, l_id_animal, start, { f_amount: 120 })

    const herdRows = await getFeedingHerdForFarm(fdm, principal_id, b_id_farm)
    const animalRows = await getFeedingAnimalForFarm(fdm, principal_id, b_id_farm)

    const farmWideRows: Feeding[] = [...herdRows, ...animalRows]
    expect(farmWideRows).toHaveLength(2)
  })

  it("should deny access to unauthorized principal", async () => {
    const invalidUser = "unauthorized_user"
    await expect(
      addFeedBatch(fdm, invalidUser, b_id_farm, "nmi_016", "own_land"),
    ).rejects.toThrowError("Principal does not have permission to perform this action")
  })

  it("should deny access to unauthorized principal for remaining feed functions", async () => {
    const f_id_batch = await addFeedBatch(fdm, principal_id, b_id_farm, "nmi_016", "own_land")
    const l_id_animal = await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
      l_id_eartag: "NL202",
    })
    const invalidUser = "unauthorized_user"

    await expect(getFeedBatchesForFarm(fdm, invalidUser, b_id_farm)).rejects.toThrowError(
      "Principal does not have permission to perform this action",
    )

    await expect(
      addFeedingHerd(fdm, invalidUser, f_id_batch, l_id_herd, new Date()),
    ).rejects.toThrowError("Principal does not have permission to perform this action")

    await expect(
      addFeedingAnimal(fdm, invalidUser, f_id_batch, l_id_animal, new Date()),
    ).rejects.toThrowError("Principal does not have permission to perform this action")

    await expect(getFeedBatch(fdm, invalidUser, f_id_batch)).rejects.toThrowError(
      "Principal does not have permission to perform this action",
    )

    await expect(getFeedingHerdForFarm(fdm, invalidUser, b_id_farm)).rejects.toThrowError(
      "Principal does not have permission to perform this action",
    )

    await expect(getFeedingAnimalForFarm(fdm, invalidUser, b_id_farm)).rejects.toThrowError(
      "Principal does not have permission to perform this action",
    )

    await expect(getFeedingSummaryForAnimal(fdm, invalidUser, l_id_animal)).rejects.toThrowError(
      "Principal does not have permission to perform this action",
    )
    await expect(getFeedingEventsForAnimal(fdm, invalidUser, l_id_animal)).rejects.toThrowError(
      "Principal does not have permission to perform this action",
    )

    const feedingStart = new Date("2025-08-01")
    await addFeedingHerd(fdm, principal_id, f_id_batch, l_id_herd, feedingStart)
    await addFeedingAnimal(fdm, principal_id, f_id_batch, l_id_animal, feedingStart)

    await expect(
      updateFeedBatch(fdm, invalidUser, f_id_batch, { f_batch_name: "Should Fail" }),
    ).rejects.toThrowError("Principal does not have permission to perform this action")

    await expect(removeFeedBatch(fdm, invalidUser, f_id_batch)).rejects.toThrowError(
      "Principal does not have permission to perform this action",
    )

    await expect(
      updateFeedingHerd(fdm, invalidUser, f_id_batch, l_id_herd, feedingStart, { f_amount: 1 }),
    ).rejects.toThrowError("Principal does not have permission to perform this action")

    await expect(
      removeFeedingHerd(fdm, invalidUser, f_id_batch, l_id_herd, feedingStart),
    ).rejects.toThrowError("Principal does not have permission to perform this action")

    await expect(
      updateFeedingAnimal(fdm, invalidUser, l_id_animal, f_id_batch, feedingStart, {
        f_amount: 1,
      }),
    ).rejects.toThrowError("Principal does not have permission to perform this action")

    await expect(
      removeFeedingAnimal(fdm, invalidUser, l_id_animal, f_id_batch, feedingStart),
    ).rejects.toThrowError("Principal does not have permission to perform this action")
  })

  it("should return additive feeding events and summary for an animal", async () => {
    const beforeReassign = new Date(Date.now() - 120_000)
    const afterReassign = new Date(Date.now() + 120_000)

    const primaryBatch = await addFeedBatch(fdm, principal_id, b_id_farm, "nmi_016", "own_land")
    const supplementBatch = await addFeedBatch(fdm, principal_id, b_id_farm, "nmi_001", "purchased")

    const l_id_animal = await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
      l_id_eartag: "NL404",
      l_arriving_date: beforeReassign,
    })

    await addFeedingHerd(fdm, principal_id, primaryBatch, l_id_herd, beforeReassign, { f_amount: 100 })
    await addFeedingAnimal(fdm, principal_id, supplementBatch, l_id_animal, beforeReassign, {
      f_amount: 20,
    })

    const targetHerdId = await addHerd(fdm, principal_id, b_id_farm, {
      l_herd_name: "Droogstand",
      l_id_category: "rvo_101",
    })
    await assignAnimalToHerd(fdm, principal_id, l_id_animal, targetHerdId)

    await addFeedingHerd(fdm, principal_id, primaryBatch, l_id_herd, afterReassign, { f_amount: 200 })
    await addFeedingHerd(fdm, principal_id, primaryBatch, targetHerdId, afterReassign, {
      f_amount: 70,
    })
    await addFeedingAnimal(fdm, principal_id, supplementBatch, l_id_animal, afterReassign, {
      f_amount: 10,
    })

    const summary = await getFeedingSummaryForAnimal(fdm, principal_id, l_id_animal)
    expect(summary).toEqual({
      f_amount: 200,
      f_dm: null,
      f_cp: null,
      f_vem: null,
      f_oeb: null,
      f_ndf: null,
    })

    const events = await getFeedingEventsForAnimal(fdm, principal_id, l_id_animal)
    expect(events).toHaveLength(4)
    expect(events.map((row) => row.l_feeding_type).sort()).toEqual([
      "animal",
      "animal",
      "herd",
      "herd",
    ])
    expect(
      events.filter((row) => row.l_feeding_type === "herd").map((row) => row.l_id_herd).sort(),
    ).toEqual([
      l_id_herd,
      targetHerdId,
    ].sort())
    expect(
      events
        .filter((row) => row.l_feeding_type === "animal")
        .every((row) => row.l_id_animal === l_id_animal),
    ).toBe(true)

    const summaryAfterOnly = await getFeedingSummaryForAnimal(fdm, principal_id, l_id_animal, {
      start: new Date(afterReassign.getTime() - 1000),
      end: undefined,
    })
    expect(summaryAfterOnly).toEqual({
      f_amount: 80,
      f_dm: null,
      f_cp: null,
      f_vem: null,
      f_oeb: null,
      f_ndf: null,
    })

    const eventsAfterOnly = await getFeedingEventsForAnimal(fdm, principal_id, l_id_animal, {
      start: new Date(afterReassign.getTime() - 1000),
      end: undefined,
    })
    expect(eventsAfterOnly).toHaveLength(2)
    expect(eventsAfterOnly.map((row) => row.l_feeding_type).sort()).toEqual([
      "animal",
      "herd",
    ])
  })
})
