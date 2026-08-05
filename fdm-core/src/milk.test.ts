import { beforeEach, describe, expect, inject, it } from "vitest"
import type { FdmType } from "./fdm.types"
import { addAnimal, assignAnimalToHerd } from "./animal"
import { addFarm } from "./farm"
import { createFdmServer } from "./fdm-server"
import { addHerd } from "./herd"
import {
  addMilkDelivery,
  addMilkingAnimal,
  addMilkingHerd,
  addMilkTank,
  getMilkDeliveriesForFarm,
  getMilkProductionForHerd,
} from "./milk"

describe("Milk Domain", () => {
  let fdm: FdmType
  let principal_id: string
  let b_id_farm: string
  let l_id_herd: string
  let b_id_milktank: string

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
      "Test Farm for Milk",
      "123456",
      "Milk Way 1",
      "1234AB",
    )

    l_id_herd = await addHerd(fdm, principal_id, b_id_farm, {
      l_herd_name: "Melkkoeien",
      l_herd_category: "rvo_100",
    })

    b_id_milktank = await addMilkTank(fdm, principal_id, b_id_farm)
  })

  it("should create milk tank and recorded milk delivery with analysis", async () => {
    const deliveryDate = new Date("2025-05-01")
    const b_id_milk_delivery = await addMilkDelivery(
      fdm,
      principal_id,
      b_id_milktank,
      deliveryDate,
      1500,
      {
        b_milk_fat: 4.35,
        b_milk_protein: 3.55,
        b_milk_urea: 21,
      },
    )

    expect(b_id_milk_delivery).toBeDefined()

    const deliveries = await getMilkDeliveriesForFarm(fdm, principal_id, b_id_farm)
    expect(deliveries.length).toBe(1)
    expect(deliveries[0].b_id_milk_delivery).toBe(b_id_milk_delivery)
    expect(deliveries[0].b_milk_amount).toBe(1500)
    expect(deliveries[0].b_milk_fat).toBe(4.35)
    expect(deliveries[0].b_milk_protein).toBe(3.55)
    expect(deliveries[0].b_milk_urea).toBe(21)
  })

  it("should resolve milk production for herd-only, animal-only, and mixed cases without double counting", async () => {
    const startDate = new Date("2025-06-01")

    // Case 1: Herd-only milking
    await addMilkingHerd(fdm, principal_id, l_id_herd, b_id_milktank, startDate, {
      b_milk_amount: 800,
    })

    let totalHerdMilk = await getMilkProductionForHerd(fdm, principal_id, l_id_herd, {
      start: startDate,
      end: startDate,
    })
    expect(totalHerdMilk).toBe(800)

    // Case 2: Adding an animal and animal-level milking (should override herd-level sum)
    const l_id_animal = await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
      l_id_eartag: "NL555555555",
      l_arriving_date: startDate,
    })

    await addMilkingAnimal(fdm, principal_id, l_id_animal, b_id_milktank, startDate, {
      b_milk_amount: 35,
    })

    // Now that an animal-level milking row exists for this herd animal, total should come from animal-level rows (35 kg)
    totalHerdMilk = await getMilkProductionForHerd(fdm, principal_id, l_id_herd, {
      start: startDate,
      end: startDate,
    })
    expect(totalHerdMilk).toBe(35)
  })

  it("should filter milk deliveries by timeframe and handle farm without tanks", async () => {
    const d1 = new Date("2025-05-01")
    const d2 = new Date("2025-06-01")

    await addMilkDelivery(fdm, principal_id, b_id_milktank, d1, 1000)
    await addMilkDelivery(fdm, principal_id, b_id_milktank, d2, 2000)

    // Filter start only
    const startOnly = await getMilkDeliveriesForFarm(fdm, principal_id, b_id_farm, {
      start: new Date("2025-05-15"),
      end: undefined,
    })
    expect(startOnly.length).toBe(1)
    expect(startOnly[0].b_milk_amount).toBe(2000)

    // Filter end only
    const endOnly = await getMilkDeliveriesForFarm(fdm, principal_id, b_id_farm, {
      start: undefined,
      end: new Date("2025-05-15"),
    })
    expect(endOnly.length).toBe(1)
    expect(endOnly[0].b_milk_amount).toBe(1000)

    // Filter both start and end
    const both = await getMilkDeliveriesForFarm(fdm, principal_id, b_id_farm, {
      start: new Date("2025-04-15"),
      end: new Date("2025-05-15"),
    })
    expect(both.length).toBe(1)
    expect(both[0].b_milk_amount).toBe(1000)

    // Farm without tanks returns empty
    const farm2 = await addFarm(fdm, principal_id, "Farm 2", "654321", "Street 2", "1234AB")
    const noTanks = await getMilkDeliveriesForFarm(fdm, principal_id, farm2)
    expect(noTanks).toEqual([])
  })

  it("should calculate milk production for herd with start-only or end-only timeframe", async () => {
    const d1 = new Date("2025-05-01")
    const d2 = new Date("2025-06-01")

    await addMilkingHerd(fdm, principal_id, l_id_herd, b_id_milktank, d1, { b_milk_amount: 500 })
    await addMilkingHerd(fdm, principal_id, l_id_herd, b_id_milktank, d2, { b_milk_amount: 700 })

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
    await addMilkingAnimal(fdm, principal_id, l_id_animal, b_id_milktank, d1, {
      b_milk_amount: 30,
    })
    await addMilkingAnimal(fdm, principal_id, l_id_animal, b_id_milktank, d2, {
      b_milk_amount: 40,
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
    await addMilkingAnimal(fdm, principal_id, l_id_animal, b_id_milktank, beforeReassignDate, {
      b_milk_amount: 12,
    })

    // Reassign to a different, already-existing herd (closes the assignment
    // in l_id_herd and opens a new one in the target herd)
    const targetHerdId = await addHerd(fdm, principal_id, b_id_farm, {
      l_herd_name: "Jongvee",
      l_herd_category: "rvo_101",
    })
    await assignAnimalToHerd(fdm, principal_id, l_id_animal, targetHerdId)

    // Milking recorded after the animal has moved to the new herd
    const afterReassignDate = new Date(Date.now() + 60_000)
    await addMilkingAnimal(fdm, principal_id, l_id_animal, b_id_milktank, afterReassignDate, {
      b_milk_amount: 18,
    })

    const originalHerdTotal = await getMilkProductionForHerd(fdm, principal_id, l_id_herd)
    expect(originalHerdTotal).toBe(12)

    const targetHerdTotal = await getMilkProductionForHerd(fdm, principal_id, targetHerdId)
    expect(targetHerdTotal).toBe(18)
  })

  it("should throw an error when adding milking with a non-existent milk tank", async () => {
    await expect(
      addMilkingHerd(fdm, principal_id, l_id_herd, "non_existent_tank_id", new Date(), {
        b_milk_amount: 100,
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

    await expect(
      addMilkingHerd(fdm, invalidUser, l_id_herd, b_id_milktank, new Date()),
    ).rejects.toThrowError("Principal does not have permission to perform this action")

    await expect(
      addMilkingAnimal(fdm, invalidUser, l_id_animal, b_id_milktank, new Date()),
    ).rejects.toThrowError("Principal does not have permission to perform this action")

    await expect(
      addMilkDelivery(fdm, invalidUser, b_id_milktank, new Date(), 100),
    ).rejects.toThrowError("Principal does not have permission to perform this action")

    await expect(
      getMilkDeliveriesForFarm(fdm, invalidUser, b_id_farm),
    ).rejects.toThrowError("Principal does not have permission to perform this action")

    await expect(
      getMilkProductionForHerd(fdm, invalidUser, l_id_herd),
    ).rejects.toThrowError("Principal does not have permission to perform this action")
  })
})
