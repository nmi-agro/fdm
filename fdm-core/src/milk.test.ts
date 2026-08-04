import { beforeEach, describe, expect, inject, it } from "vitest"
import type { FdmType } from "./fdm.types"
import { addAnimal } from "./animal"
import { addFarm } from "./farm"
import { createFdmServer } from "./fdm-server"
import { addHerd } from "./herd"
import {
  addMilkDelivery,
  addMilking,
  addMilkingAnimal,
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
    await addMilking(fdm, principal_id, l_id_herd, b_id_milktank, startDate, {
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

  it("should deny access to unauthorized principal", async () => {
    const invalidUser = "unauthorized_user"
    await expect(addMilkTank(fdm, invalidUser, b_id_farm)).rejects.toThrowError(
      "Principal does not have permission to perform this action",
    )
  })
})
