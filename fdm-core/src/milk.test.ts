import { beforeEach, describe, expect, inject, it } from "vitest"
import { getAnimalCategoriesCatalogue } from "@nmi-agro/fdm-data"
import type { FdmType } from "./fdm.types"
import type { MilkingAnimal, MilkingHerd } from "./milk.types"
import { addAnimal, assignAnimalToHerd } from "./animal"
import { addFarm } from "./farm"
import { createFdmServer } from "./fdm-server"
import { addHerd } from "./herd"
import { syncAnimalCategoryCatalogueArray } from "./catalogues"
import {
  addMilkDelivery,
  addMilkingAnimal,
  addMilkingHerd,
  addMilkTank,
  getMilkingEventsForAnimal,
  getMilkingSummaryForAnimal,
  getMilkDelivery,
  getMilkDeliveriesForFarm,
  getMilkingAnimal,
  getMilkingHerd,
  getMilkProductionForHerd,
  getMilkTank,
  getMilkTanksForFarm,
  removeMilkDelivery,
  removeMilkingAnimal,
  removeMilkingHerd,
  removeMilkTank,
  updateMilkDelivery,
  updateMilkingAnimal,
  updateMilkingHerd,
  updateMilkTank,
} from "./milk"

describe("Milk Domain", () => {
  let fdm: FdmType
  let principal_id: string
  let b_id_farm: string
  let l_id_herd: string
  let l_id_milktank: string

  beforeEach(async () => {
    const host = inject("host")
    const port = inject("port")
    const user = inject("user")
    const password = inject("password")
    const database = inject("database")
    fdm = createFdmServer(host, port, user, password, database)
    await syncAnimalCategoryCatalogueArray(fdm, await getAnimalCategoriesCatalogue("rvo"))
    principal_id = "test_principal"

    b_id_farm = await addFarm(
      fdm,
      principal_id,
      "Test Farm for Milk",
      "123456",
      "Milk Way 1",
      "1234AB",
    )

    l_id_herd = await addHerd(fdm, principal_id, b_id_farm, {
      l_herd_name: "Melkkoeien",
      l_id_category: "rvo_100",
    })

    l_id_milktank = await addMilkTank(fdm, principal_id, b_id_farm)
  })

  it("should create milk tank and recorded milk delivery with analysis", async () => {
    const deliveryDate = new Date("2025-05-01")
    const l_id_milkdelivery = await addMilkDelivery(
      fdm,
      principal_id,
      l_id_milktank,
      deliveryDate,
      1500,
      {
        l_milk_fat: 4.35,
        l_milk_protein: 3.55,
        l_milk_urea: 21,
      },
    )

    expect(l_id_milkdelivery).toBeDefined()

    const deliveries = await getMilkDeliveriesForFarm(fdm, principal_id, b_id_farm)
    expect(deliveries.length).toBe(1)
    expect(deliveries[0].l_id_milkdelivery).toBe(l_id_milkdelivery)
    expect(deliveries[0].l_milkdelivery_amount).toBe(1500)
    expect(deliveries[0].l_milk_fat).toBe(4.35)
    expect(deliveries[0].l_milk_protein).toBe(3.55)
    expect(deliveries[0].l_milk_urea).toBe(21)
  })

  it("should update and remove a milk tank, milking herd, milking animal, and milk delivery", async () => {
    const tank = await getMilkTank(fdm, principal_id, l_id_milktank)
    expect(tank.l_id_milktank).toBe(l_id_milktank)

    const tanksForFarm = await getMilkTanksForFarm(fdm, principal_id, b_id_farm)
    expect(tanksForFarm.map((t) => t.l_id_milktank)).toContain(l_id_milktank)

    await updateMilkTank(fdm, principal_id, l_id_milktank, { l_milktank_name: "Tank A" })
    expect((await getMilkTank(fdm, principal_id, l_id_milktank)).l_milktank_name).toBe("Tank A")

    const milkingStart = new Date("2025-05-01")
    await addMilkingHerd(fdm, principal_id, l_id_herd, l_id_milktank, milkingStart, {
      l_milking_amount: 100,
    })
    const [milkingHerdRecord] = await getMilkingHerd(fdm, principal_id, l_id_herd)
    expect(milkingHerdRecord.l_milking_amount).toBe(100)

    await updateMilkingHerd(fdm, principal_id, l_id_herd, l_id_milktank, milkingStart, {
      l_milking_amount: 150,
    })
    expect((await getMilkingHerd(fdm, principal_id, l_id_herd))[0].l_milking_amount).toBe(150)
    expect(
      await getMilkProductionForHerd(fdm, principal_id, l_id_herd, {
        start: milkingStart,
        end: milkingStart,
      }),
    ).toBe(150)
    await removeMilkingHerd(fdm, principal_id, l_id_herd, l_id_milktank, milkingStart)
    expect(await getMilkingHerd(fdm, principal_id, l_id_herd)).toEqual([])
    expect(
      await getMilkProductionForHerd(fdm, principal_id, l_id_herd, {
        start: milkingStart,
        end: milkingStart,
      }),
    ).toBe(0)

    const l_id_animal = await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
      l_id_eartag: "NL333333333",
      l_arriving_date: milkingStart,
    })
    await addMilkingAnimal(fdm, principal_id, l_id_animal, l_id_milktank, milkingStart, {
      l_milking_amount: 20,
    })
    const [milkingAnimalRecord] = await getMilkingAnimal(fdm, principal_id, l_id_animal)
    expect(milkingAnimalRecord.l_milking_amount).toBe(20)

    await updateMilkingAnimal(fdm, principal_id, l_id_animal, l_id_milktank, milkingStart, {
      l_milking_amount: 25,
    })
    expect((await getMilkingAnimal(fdm, principal_id, l_id_animal))[0].l_milking_amount).toBe(25)
    expect(
      await getMilkProductionForHerd(fdm, principal_id, l_id_herd, {
        start: milkingStart,
        end: milkingStart,
      }),
    ).toBe(25)
    await removeMilkingAnimal(fdm, principal_id, l_id_animal, l_id_milktank, milkingStart)
    expect(await getMilkingAnimal(fdm, principal_id, l_id_animal)).toEqual([])

    const l_id_milkdelivery = await addMilkDelivery(
      fdm,
      principal_id,
      l_id_milktank,
      milkingStart,
      1000,
    )
    const [delivery] = await getMilkDeliveriesForFarm(fdm, principal_id, b_id_farm)
    expect(delivery.l_id_milkdelivery).toBe(l_id_milkdelivery)

    const singleDelivery = await getMilkDelivery(fdm, principal_id, delivery.l_id_milkdelivery!)
    expect(singleDelivery.l_milkdelivery_amount).toBe(1000)

    await updateMilkDelivery(fdm, principal_id, delivery.l_id_milkdelivery!, {
      l_milkdelivery_amount: 1200,
    })
    const [updatedDelivery] = await getMilkDeliveriesForFarm(fdm, principal_id, b_id_farm)
    expect(updatedDelivery.l_milkdelivery_amount).toBe(1200)

    await updateMilkDelivery(fdm, principal_id, delivery.l_id_milkdelivery!, {
      l_milk_fat: 4.4,
      l_milk_protein: 3.6,
      l_milksampling_date: new Date("2025-05-02"),
    })
    const updatedWithAnalysis = await getMilkDelivery(
      fdm,
      principal_id,
      delivery.l_id_milkdelivery!,
    )
    expect(updatedWithAnalysis.l_milk_fat).toBe(4.4)
    expect(updatedWithAnalysis.l_milk_protein).toBe(3.6)
    expect(updatedWithAnalysis).toHaveProperty(
      "l_milksampling_date",
      new Date("2025-05-02"),
    )

    await removeMilkDelivery(fdm, principal_id, delivery.l_id_milkdelivery!)
    expect(await getMilkDeliveriesForFarm(fdm, principal_id, b_id_farm)).toEqual([])
    await expect(
      getMilkDelivery(fdm, principal_id, delivery.l_id_milkdelivery!),
    ).rejects.toThrowError("Exception for getMilkDelivery")

    // Tank can now be removed since no milking/delivery records reference it
    await removeMilkTank(fdm, principal_id, l_id_milktank)
    // checkPermission fails closed since the resource chain can no longer resolve it
    await expect(getMilkTank(fdm, principal_id, l_id_milktank)).rejects.toThrowError(
      "Principal does not have permission to perform this action",
    )
  })

  it("should reject removing a milk tank that has milking or delivery records", async () => {
    await addMilkDelivery(fdm, principal_id, l_id_milktank, new Date(), 500)

    await expect(removeMilkTank(fdm, principal_id, l_id_milktank)).rejects.toThrowError(
      "Exception for removeMilkTank",
    )
  })

  it("should allow farm-wide Milking union arrays from herd and animal records", async () => {
    const l_id_animal = await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
      l_id_eartag: "NL-MILK-UNION-1",
    })
    const start = new Date("2025-05-03T00:00:00.000Z")

    await addMilkingHerd(fdm, principal_id, l_id_herd, l_id_milktank, start, {
      l_milking_amount: 250,
    })
    await addMilkingAnimal(fdm, principal_id, l_id_animal, l_id_milktank, start, {
      l_milking_amount: 30,
    })

    const herdRows = await getMilkingHerd(fdm, principal_id, l_id_herd)
    const animalRows = await getMilkingAnimal(fdm, principal_id, l_id_animal)

    const farmWideRows: Array<MilkingHerd | MilkingAnimal> = [...herdRows, ...animalRows]
    expect(farmWideRows).toHaveLength(2)
  })

  it("should resolve milk production for herd-only, animal-only, and mixed additive cases", async () => {
    const startDate = new Date("2025-06-01")

    // Case 1: Herd-only milking
    await addMilkingHerd(fdm, principal_id, l_id_herd, l_id_milktank, startDate, {
      l_milking_amount: 800,
    })

    let totalHerdMilk = await getMilkProductionForHerd(fdm, principal_id, l_id_herd, {
      start: startDate,
      end: startDate,
    })
    expect(totalHerdMilk).toBe(800)

    // Case 2: Animal-level milking is an additive supplement on top of herd-level milking
    const l_id_animal = await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
      l_id_eartag: "NL555555555",
      l_arriving_date: startDate,
    })

    await addMilkingAnimal(fdm, principal_id, l_id_animal, l_id_milktank, startDate, {
      l_milking_amount: 35,
    })

    // Combined herd production now combines herd-level + animal-level rows.
    totalHerdMilk = await getMilkProductionForHerd(fdm, principal_id, l_id_herd, {
      start: startDate,
      end: startDate,
    })
    expect(totalHerdMilk).toBe(835)

    const milkingSummary = await getMilkingSummaryForAnimal(fdm, principal_id, l_id_animal, {
      start: startDate,
      end: startDate,
    })
    expect(milkingSummary).toEqual({
      l_milking_amount: 835,
      l_milk_fat: null,
      l_milk_protein: null,
      l_milk_lactose: null,
      l_milk_urea: null,
      l_milk_scc: null,
    })

    const milkingEvents = await getMilkingEventsForAnimal(fdm, principal_id, l_id_animal, {
      start: startDate,
      end: startDate,
    })
    expect(milkingEvents).toHaveLength(2)
    expect(milkingEvents.map((row) => row.type).sort()).toEqual(["animal", "herd"])
  })

  it("should filter milk deliveries by timeframe and handle farm without tanks", async () => {
    const d1 = new Date("2025-05-01")
    const d2 = new Date("2025-06-01")

    await addMilkDelivery(fdm, principal_id, l_id_milktank, d1, 1000)
    await addMilkDelivery(fdm, principal_id, l_id_milktank, d2, 2000)

    // Filter start only
    const startOnly = await getMilkDeliveriesForFarm(fdm, principal_id, b_id_farm, {
      start: new Date("2025-05-15"),
      end: undefined,
    })
    expect(startOnly.length).toBe(1)
    expect(startOnly[0].l_milkdelivery_amount).toBe(2000)

    // Filter end only
    const endOnly = await getMilkDeliveriesForFarm(fdm, principal_id, b_id_farm, {
      start: undefined,
      end: new Date("2025-05-15"),
    })
    expect(endOnly.length).toBe(1)
    expect(endOnly[0].l_milkdelivery_amount).toBe(1000)

    // Filter both start and end
    const both = await getMilkDeliveriesForFarm(fdm, principal_id, b_id_farm, {
      start: new Date("2025-04-15"),
      end: new Date("2025-05-15"),
    })
    expect(both.length).toBe(1)
    expect(both[0].l_milkdelivery_amount).toBe(1000)

    // Farm without tanks returns empty
    const farm2 = await addFarm(fdm, principal_id, "Farm 2", "654321", "Street 2", "1234AB")
    const noTanks = await getMilkDeliveriesForFarm(fdm, principal_id, farm2)
    expect(noTanks).toEqual([])
  })

  it("should calculate milk production for herd with start-only or end-only timeframe", async () => {
    const d1 = new Date("2025-05-01")
    const d2 = new Date("2025-06-01")

    await addMilkingHerd(fdm, principal_id, l_id_herd, l_id_milktank, d1, { l_milking_amount: 500 })
    await addMilkingHerd(fdm, principal_id, l_id_herd, l_id_milktank, d2, { l_milking_amount: 700 })

    const startOnly = await getMilkProductionForHerd(fdm, principal_id, l_id_herd, {
      start: new Date("2025-05-15"),
      end: undefined,
    })
    expect(startOnly).toBe(700)

    const endOnly = await getMilkProductionForHerd(fdm, principal_id, l_id_herd, {
      start: undefined,
      end: new Date("2025-05-15"),
    })
    expect(endOnly).toBe(500)
  })

  it("should calculate animal-level milk production with start-only or end-only timeframe", async () => {
    const d1 = new Date("2025-05-01")
    const d2 = new Date("2025-06-01")

    const l_id_animal = await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
      l_id_eartag: "NL777777777",
      l_arriving_date: d1,
    })
    await addMilkingAnimal(fdm, principal_id, l_id_animal, l_id_milktank, d1, {
      l_milking_amount: 30,
    })
    await addMilkingAnimal(fdm, principal_id, l_id_animal, l_id_milktank, d2, {
      l_milking_amount: 40,
    })

    const startOnly = await getMilkProductionForHerd(fdm, principal_id, l_id_herd, {
      start: new Date("2025-05-15"),
      end: undefined,
    })
    expect(startOnly).toBe(40)

    const endOnly = await getMilkProductionForHerd(fdm, principal_id, l_id_herd, {
      start: undefined,
      end: new Date("2025-05-15"),
    })
    expect(endOnly).toBe(30)
  })

  it("should not double count milk production across herds after reassignment via assignAnimalToHerd", async () => {
    const arrivingDate = new Date("2025-01-01")
    const l_id_animal = await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
      l_id_eartag: "NL999999999",
      l_arriving_date: arrivingDate,
    })

    // Milking recorded while the animal is still in the original herd
    const beforeReassignDate = new Date("2025-02-01")
    await addMilkingAnimal(fdm, principal_id, l_id_animal, l_id_milktank, beforeReassignDate, {
      l_milking_amount: 12,
    })

    // Reassign to a different, already-existing herd (closes the assignment
    // in l_id_herd and opens a new one in the target herd)
    const targetHerdId = await addHerd(fdm, principal_id, b_id_farm, {
      l_herd_name: "Jongvee",
      l_id_category: "rvo_101",
    })
    await assignAnimalToHerd(fdm, principal_id, l_id_animal, targetHerdId)

    // Milking recorded after the animal has moved to the new herd
    const afterReassignDate = new Date(Date.now() + 60_000)
    await addMilkingAnimal(fdm, principal_id, l_id_animal, l_id_milktank, afterReassignDate, {
      l_milking_amount: 18,
    })

    const originalHerdTotal = await getMilkProductionForHerd(fdm, principal_id, l_id_herd)
    expect(originalHerdTotal).toBe(12)

    const targetHerdTotal = await getMilkProductionForHerd(fdm, principal_id, targetHerdId)
    expect(targetHerdTotal).toBe(18)
  })

  it("should calculate combined milk production for an animal as herd + animal supplements", async () => {
    const beforeReassignDate = new Date(Date.now() - 120_000)
    const afterReassignDate = new Date(Date.now() + 120_000)

    const l_id_animal = await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
      l_id_eartag: "NL888888888",
      l_arriving_date: beforeReassignDate,
    })

    await addMilkingHerd(fdm, principal_id, l_id_herd, l_id_milktank, beforeReassignDate, {
      l_milking_amount: 500,
    })
    await addMilkingAnimal(fdm, principal_id, l_id_animal, l_id_milktank, beforeReassignDate, {
      l_milking_amount: 20,
    })

    const targetHerdId = await addHerd(fdm, principal_id, b_id_farm, {
      l_herd_name: "Droogstand",
      l_id_category: "rvo_101",
    })
    await assignAnimalToHerd(fdm, principal_id, l_id_animal, targetHerdId)

    await addMilkingHerd(fdm, principal_id, l_id_herd, l_id_milktank, afterReassignDate, {
      l_milking_amount: 400,
    })
    await addMilkingHerd(fdm, principal_id, targetHerdId, l_id_milktank, afterReassignDate, {
      l_milking_amount: 300,
    })
    await addMilkingAnimal(fdm, principal_id, l_id_animal, l_id_milktank, afterReassignDate, {
      l_milking_amount: 15,
    })

    const summary = await getMilkingSummaryForAnimal(fdm, principal_id, l_id_animal)
    expect(summary).toEqual({
      l_milking_amount: 835,
      l_milk_fat: null,
      l_milk_protein: null,
      l_milk_lactose: null,
      l_milk_urea: null,
      l_milk_scc: null,
    })

    const events = await getMilkingEventsForAnimal(fdm, principal_id, l_id_animal)
    expect(events).toHaveLength(4)
    expect(events.map((row) => row.type).sort()).toEqual(["animal", "animal", "herd", "herd"])
    expect(
      events
        .filter((row) => row.type === "herd")
        .map((row) => row.l_id_herd)
        .sort(),
    ).toEqual([l_id_herd, targetHerdId].sort())
    expect(
      events.filter((row) => row.type === "animal").every((row) => row.l_id_animal === l_id_animal),
    ).toBe(true)

    const summaryAfterOnly = await getMilkingSummaryForAnimal(fdm, principal_id, l_id_animal, {
      start: new Date(afterReassignDate.getTime() - 1000),
      end: undefined,
    })
    expect(summaryAfterOnly).toEqual({
      l_milking_amount: 315,
      l_milk_fat: null,
      l_milk_protein: null,
      l_milk_lactose: null,
      l_milk_urea: null,
      l_milk_scc: null,
    })

    const eventsAfterOnly = await getMilkingEventsForAnimal(fdm, principal_id, l_id_animal, {
      start: new Date(afterReassignDate.getTime() - 1000),
      end: undefined,
    })
    expect(eventsAfterOnly).toHaveLength(2)
    expect(eventsAfterOnly.map((row) => row.type).sort()).toEqual(["animal", "herd"])
  })

  it("should throw an error when adding milking with a non-existent milk tank", async () => {
    await expect(
      addMilkingHerd(fdm, principal_id, l_id_herd, "non_existent_tank_id", new Date(), {
        l_milking_amount: 100,
      }),
    ).rejects.toThrowError("Exception for addMilkingHerd")
  })

  it("should deny access to unauthorized principal", async () => {
    const invalidUser = "unauthorized_user"
    await expect(addMilkTank(fdm, invalidUser, b_id_farm)).rejects.toThrowError(
      "Principal does not have permission to perform this action",
    )
  })

  it("should deny access to unauthorized principal for remaining milk functions", async () => {
    const invalidUser = "unauthorized_user"
    const l_id_animal = await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
      l_id_eartag: "NL222222222",
    })
    const milkingStart = new Date()
    await addMilkingHerd(fdm, principal_id, l_id_herd, l_id_milktank, milkingStart)
    await addMilkingAnimal(fdm, principal_id, l_id_animal, l_id_milktank, milkingStart)
    const l_id_milkdelivery = await addMilkDelivery(
      fdm,
      principal_id,
      l_id_milktank,
      milkingStart,
      100,
    )
    const [delivery] = await getMilkDeliveriesForFarm(fdm, principal_id, b_id_farm)
    expect(delivery.l_id_milkdelivery).toBe(l_id_milkdelivery)

    await expect(
      addMilkingHerd(fdm, invalidUser, l_id_herd, l_id_milktank, new Date()),
    ).rejects.toThrowError("Principal does not have permission to perform this action")

    await expect(
      addMilkingAnimal(fdm, invalidUser, l_id_animal, l_id_milktank, new Date()),
    ).rejects.toThrowError("Principal does not have permission to perform this action")

    await expect(
      addMilkDelivery(fdm, invalidUser, l_id_milktank, new Date(), 100),
    ).rejects.toThrowError("Principal does not have permission to perform this action")

    await expect(getMilkDeliveriesForFarm(fdm, invalidUser, b_id_farm)).rejects.toThrowError(
      "Principal does not have permission to perform this action",
    )

    await expect(getMilkProductionForHerd(fdm, invalidUser, l_id_herd)).rejects.toThrowError(
      "Principal does not have permission to perform this action",
    )

    await expect(getMilkingSummaryForAnimal(fdm, invalidUser, l_id_animal)).rejects.toThrowError(
      "Principal does not have permission to perform this action",
    )
    await expect(getMilkingEventsForAnimal(fdm, invalidUser, l_id_animal)).rejects.toThrowError(
      "Principal does not have permission to perform this action",
    )

    await expect(getMilkTank(fdm, invalidUser, l_id_milktank)).rejects.toThrowError(
      "Principal does not have permission to perform this action",
    )

    await expect(getMilkTanksForFarm(fdm, invalidUser, b_id_farm)).rejects.toThrowError(
      "Principal does not have permission to perform this action",
    )

    await expect(getMilkingHerd(fdm, invalidUser, l_id_herd)).rejects.toThrowError(
      "Principal does not have permission to perform this action",
    )

    await expect(getMilkingAnimal(fdm, invalidUser, l_id_animal)).rejects.toThrowError(
      "Principal does not have permission to perform this action",
    )

    await expect(
      getMilkDelivery(fdm, invalidUser, delivery.l_id_milkdelivery!),
    ).rejects.toThrowError("Principal does not have permission to perform this action")

    await expect(
      updateMilkTank(fdm, invalidUser, l_id_milktank, { l_milktank_name: "Should Fail" }),
    ).rejects.toThrowError("Principal does not have permission to perform this action")

    await expect(removeMilkTank(fdm, invalidUser, l_id_milktank)).rejects.toThrowError(
      "Principal does not have permission to perform this action",
    )

    await expect(
      updateMilkingHerd(fdm, invalidUser, l_id_herd, l_id_milktank, milkingStart, {
        l_milking_amount: 200,
      }),
    ).rejects.toThrowError("Principal does not have permission to perform this action")

    await expect(
      removeMilkingHerd(fdm, invalidUser, l_id_herd, l_id_milktank, milkingStart),
    ).rejects.toThrowError("Principal does not have permission to perform this action")

    await expect(
      updateMilkingAnimal(fdm, invalidUser, l_id_animal, l_id_milktank, milkingStart, {
        l_milking_amount: 200,
      }),
    ).rejects.toThrowError("Principal does not have permission to perform this action")

    await expect(
      removeMilkingAnimal(fdm, invalidUser, l_id_animal, l_id_milktank, milkingStart),
    ).rejects.toThrowError("Principal does not have permission to perform this action")

    await expect(
      updateMilkDelivery(fdm, invalidUser, delivery.l_id_milkdelivery!, {
        l_milkdelivery_amount: 200,
      }),
    ).rejects.toThrowError("Principal does not have permission to perform this action")

    await expect(
      removeMilkDelivery(fdm, invalidUser, delivery.l_id_milkdelivery!),
    ).rejects.toThrowError("Principal does not have permission to perform this action")
  })
})
