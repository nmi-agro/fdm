import { getAnimalCategoriesCatalogue, getFeedCatalogue } from "@nmi-agro/fdm-data"
import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, inject, it } from "vitest"
import type { FdmType } from "./fdm.types"
import type { Feeding } from "./feed.types"
import { addAnimal, assignAnimalToHerd } from "./animal"
import {
  enableAnimalCategoryCatalogue,
  enableFeedCatalogue,
  syncAnimalCategoryCatalogueArray,
  syncFeedCatalogueArray,
} from "./catalogues"
import * as schema from "./db/schema"
import { addFarm, removeFarm } from "./farm"
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
  getFeedsFromCatalogues,
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
    await enableAnimalCategoryCatalogue(fdm, principal_id, b_id_farm, "rvo")

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
    const f_id_batch_own = await addFeedBatch(fdm, principal_id, b_id_farm, "nmi_016", "own_land", {
      f_dm: 450,
      f_cp: 160,
    })

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
      l_id_eartag: "NL101000000",
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
      l_id_eartag: "NL303000000",
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
      l_id_eartag: "NL700000104",
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
      l_id_eartag: "NL202000000",
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
      l_id_eartag: "NL404000000",
      l_arriving_date: beforeReassign,
    })

    await addFeedingHerd(fdm, principal_id, primaryBatch, l_id_herd, beforeReassign, {
      f_amount: 100,
    })
    await addFeedingAnimal(fdm, principal_id, supplementBatch, l_id_animal, beforeReassign, {
      f_amount: 20,
    })

    const targetHerdId = await addHerd(fdm, principal_id, b_id_farm, {
      l_herd_name: "Droogstand",
      l_id_category: "rvo_101",
    })
    await assignAnimalToHerd(fdm, principal_id, l_id_animal, targetHerdId)

    await addFeedingHerd(fdm, principal_id, primaryBatch, l_id_herd, afterReassign, {
      f_amount: 200,
    })
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
      events
        .filter((row) => row.l_feeding_type === "herd")
        .map((row) => row.l_id_herd)
        .sort(),
    ).toEqual([l_id_herd, targetHerdId].sort())
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
    expect(eventsAfterOnly.map((row) => row.l_feeding_type).sort()).toEqual(["animal", "herd"])
  })

  it("should reject feeding from a batch of another farm", async () => {
    const otherFarm = await addFarm(fdm, principal_id, "Other Farm", "654321", "Road 2", "1234AB")
    const otherBatch = await addFeedBatch(fdm, principal_id, otherFarm, "snijmais", "own_land")
    const l_id_animal = await addAnimal(fdm, principal_id, b_id_farm, l_id_herd)
    const otherFarmError = {
      cause: { message: expect.stringContaining("belongs to another farm") },
    }

    await expect(
      addFeedingHerd(fdm, principal_id, otherBatch, l_id_herd, new Date("2025-05-01")),
    ).rejects.toMatchObject(otherFarmError)
    await expect(
      addFeedingAnimal(fdm, principal_id, otherBatch, l_id_animal, new Date("2025-05-01")),
    ).rejects.toMatchObject(otherFarmError)
  })

  it("should not use another farm's own catalogue item for a feed batch", async () => {
    const otherFarm = await addFarm(
      fdm,
      principal_id,
      "Other Feed Farm",
      "654321",
      "Weg 2",
      "4321BA",
    )
    const otherItem = await addFeedToCatalogue(fdm, principal_id, otherFarm, {
      f_name_nl: "Krachtvoer van de buren",
      f_type_rvo: "gras_kuil",
      f_dm: 900,
      f_n_dm: 25,
      f_p_dm: 7,
    })

    // Its ID is refused for this farm
    await expect(
      addFeedBatch(fdm, principal_id, b_id_farm, otherItem, "purchased"),
    ).rejects.toMatchObject({
      cause: { message: expect.stringContaining("Feed catalogue item not found") },
    })
    // Its feed type finds the standard item, not the other farm's own one
    const f_id_batch = await addFeedBatch(fdm, principal_id, b_id_farm, "gras_kuil", "purchased")
    expect((await getFeedBatch(fdm, principal_id, f_id_batch)).f_id_catalogue).not.toBe(otherItem)
    await expect(
      updateFeedBatch(fdm, principal_id, f_id_batch, { f_id_catalogue: otherItem }),
    ).rejects.toMatchObject({
      cause: { message: expect.stringContaining("Feed catalogue item not found") },
    })

    // The other farm can use it, and removing that farm is not blocked by this farm
    await addFeedBatch(fdm, principal_id, otherFarm, otherItem, "purchased")
    await removeFarm(fdm, principal_id, otherFarm)
  })

  it("should prefer the standard item for a feed type and use an own item by its ID", async () => {
    const ownItem = await addFeedToCatalogue(fdm, principal_id, b_id_farm, {
      f_name_nl: "Eigen graskuil",
      f_type_rvo: "gras_kuil",
      f_dm: 400,
      f_n_dm: 28,
      f_p_dm: 4,
    })
    const sourceOf = async (f_id_catalogue: string) => {
      const [item] = await fdm
        .select({ f_source: schema.feedsCatalogue.f_source })
        .from(schema.feedsCatalogue)
        .where(eq(schema.feedsCatalogue.f_id_catalogue, f_id_catalogue))
      return item?.f_source
    }

    // By feed type, the standard item comes before the farm's own one
    const byType = await addFeedBatch(fdm, principal_id, b_id_farm, "gras_kuil", "own_land")
    const standardItem = (await getFeedBatch(fdm, principal_id, byType)).f_id_catalogue
    expect(standardItem).not.toBe(ownItem)
    expect(await sourceOf(standardItem)).toBe("nmi")

    // By its ID, the own item is used
    const byId = await addFeedBatch(fdm, principal_id, b_id_farm, ownItem, "own_land")
    expect((await getFeedBatch(fdm, principal_id, byId)).f_id_catalogue).toBe(ownItem)
  })

  it("should only enable a standard feed catalogue or the farm's own", async () => {
    const otherFarm = await addFarm(
      fdm,
      principal_id,
      "Other Feed Farm",
      "654321",
      "Weg 2",
      "4321BA",
    )
    await expect(
      enableFeedCatalogue(fdm, principal_id, b_id_farm, otherFarm),
    ).rejects.toMatchObject({
      cause: { message: expect.stringContaining("not available for this farm") },
    })
    await enableFeedCatalogue(fdm, principal_id, b_id_farm, b_id_farm)
    await enableFeedCatalogue(fdm, principal_id, b_id_farm, "nmi")
  })

  it("should reject a feed batch with an unknown catalogue item", async () => {
    await expect(
      addFeedBatch(fdm, principal_id, b_id_farm, "unknown_feed", "purchased"),
    ).rejects.toMatchObject({
      cause: { message: expect.stringContaining("Feed catalogue item not found") },
    })
  })

  it("should list feeds only from catalogue sources the principal can use", async () => {
    expect(await getFeedsFromCatalogues(fdm, principal_id, [])).toEqual([])
    // No farm of this principal has the source enabled
    expect(await getFeedsFromCatalogues(fdm, "someone_else", ["nmi"])).toEqual([])

    await enableFeedCatalogue(fdm, principal_id, b_id_farm, "nmi")
    const feeds = await getFeedsFromCatalogues(fdm, principal_id, ["nmi"])
    expect(feeds.length).toBeGreaterThan(0)
    expect(feeds.every((feed) => feed.f_source === "nmi")).toBe(true)
  })

  it("should add an analysis to a batch without one and update all its values", async () => {
    const f_id_batch = await addFeedBatch(fdm, principal_id, b_id_farm, "snijmais", "own_land")

    // A batch without an analysis gets one
    await updateFeedBatch(fdm, principal_id, f_id_batch, {
      f_dm: 350,
      f_vem: 950,
      f_sampling_date: new Date("2025-06-01"),
    })
    let batch = await getFeedBatch(fdm, principal_id, f_id_batch)
    expect(batch.f_dm).toBe(350)
    expect(batch.f_vem).toBe(950)

    // The existing analysis is updated, and the catalogue item can be set by its RVO type
    await updateFeedBatch(fdm, principal_id, f_id_batch, {
      f_batch_type: "korrelmais",
      f_cp: 80,
      f_oeb: -20,
      f_ndf: 400,
      f_sampling_date: new Date("2025-06-15"),
    })
    batch = await getFeedBatch(fdm, principal_id, f_id_batch)
    expect(batch.f_cp).toBe(80)
    expect(batch.f_oeb).toBe(-20)
    expect(batch.f_ndf).toBe(400)
    expect(batch.f_vem).toBe(950)
  })

  it("should refuse to remove a feed batch that is still fed", async () => {
    const f_id_batch = await addFeedBatch(fdm, principal_id, b_id_farm, "snijmais", "own_land")
    const start = new Date("2025-05-01")
    await addFeedingHerd(fdm, principal_id, f_id_batch, l_id_herd, start)
    await expect(removeFeedBatch(fdm, principal_id, f_id_batch)).rejects.toMatchObject({
      cause: { message: expect.stringContaining("a herd_feeding record references it") },
    })
    await removeFeedingHerd(fdm, principal_id, f_id_batch, l_id_herd, start)

    const l_id_animal = await addAnimal(fdm, principal_id, b_id_farm, l_id_herd)
    await addFeedingAnimal(fdm, principal_id, f_id_batch, l_id_animal, start)
    await expect(removeFeedBatch(fdm, principal_id, f_id_batch)).rejects.toMatchObject({
      cause: { message: expect.stringContaining("an animal_feeding record references it") },
    })
  })

  it("should report feeding records that do not exist", async () => {
    const f_id_batch = await addFeedBatch(fdm, principal_id, b_id_farm, "snijmais", "own_land")
    const l_id_animal = await addAnimal(fdm, principal_id, b_id_farm, l_id_herd)
    const missingStart = new Date("2020-01-01")
    const notFound = { cause: { message: expect.stringContaining("not found") } }

    await expect(
      updateFeedingHerd(fdm, principal_id, f_id_batch, l_id_herd, missingStart, { f_amount: 1 }),
    ).rejects.toMatchObject(notFound)
    await expect(
      removeFeedingHerd(fdm, principal_id, f_id_batch, l_id_herd, missingStart),
    ).rejects.toMatchObject(notFound)
    await expect(
      updateFeedingAnimal(fdm, principal_id, l_id_animal, f_id_batch, missingStart, {
        f_amount: 1,
      }),
    ).rejects.toMatchObject(notFound)
    await expect(
      removeFeedingAnimal(fdm, principal_id, l_id_animal, f_id_batch, missingStart),
    ).rejects.toMatchObject(notFound)
  })
})
