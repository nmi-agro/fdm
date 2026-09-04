import { beforeEach, describe, expect, inject, it } from "vitest"
import { getAnimalCategoriesCatalogue } from "@nmi-agro/fdm-data"
import type { FdmType } from "./fdm.types"
import { addAnimal } from "./animal"
import { addFarm } from "./farm"
import { createFdmServer } from "./fdm-server"
import { addHerd, getHerd, getHerdsForFarm, removeHerd, updateHerd } from "./herd"
import { syncAnimalCategoryCatalogueArray } from "./catalogues"

describe("Herd Domain", () => {
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
    await syncAnimalCategoryCatalogueArray(fdm, await getAnimalCategoriesCatalogue("rvo"))
    principal_id = "test_principal"

    b_id_farm = await addFarm(
      fdm,
      principal_id,
      "Test Farm for Herds",
      "123456",
      "Farm Street 1",
      "1234AB",
    )
  })

  it("should create, read, update, and list herds", async () => {
    const l_id_herd = await addHerd(fdm, principal_id, b_id_farm, {
      l_herd_name: "Melkkoeien",
      l_id_category: "rvo_100",
    })

    expect(l_id_herd).toBeDefined()

    const herd = await getHerd(fdm, principal_id, l_id_herd)
    expect(herd.l_herd_name).toBe("Melkkoeien")
    expect(herd.l_id_category).toBe("rvo_100")
    expect(herd.l_category).toBe("100 - Melk- en kalfkoeien")
    expect(herd.l_specie).toBe("cattle")
    expect(herd.l_sex_options).toEqual(["female"])
    expect(herd.l_lsu).toBe(1)
    expect(herd.b_id_farm).toBe(b_id_farm)

    await updateHerd(fdm, principal_id, l_id_herd, {
      l_herd_name: "Melkkoeien Groep A",
      l_id_category: "rvo_101",
    })

    const updated = await getHerd(fdm, principal_id, l_id_herd)
    expect(updated.l_herd_name).toBe("Melkkoeien Groep A")
    expect(updated.l_id_category).toBe("rvo_101")

    const herds = await getHerdsForFarm(fdm, principal_id, b_id_farm)
    expect(herds.length).toBe(1)
    expect(herds[0].l_id_herd).toBe(l_id_herd)
  })

  it("should remove a herd", async () => {
    const l_id_herd = await addHerd(fdm, principal_id, b_id_farm, {
      l_herd_name: "Jongvee",
      l_id_category: "rvo_101",
    })

    await removeHerd(fdm, principal_id, l_id_herd)

    const herds = await getHerdsForFarm(fdm, principal_id, b_id_farm)
    expect(herds.length).toBe(0)
  })

  it("should record and update that a herd has ended via l_end", async () => {
    const l_id_herd = await addHerd(fdm, principal_id, b_id_farm, {
      l_herd_name: "Uitfaseren",
      l_id_category: "rvo_101",
    })

    const endDate = new Date("2025-06-01")
    await updateHerd(fdm, principal_id, l_id_herd, { l_end: endDate })

    const herd = await getHerd(fdm, principal_id, l_id_herd)
    expect(herd.l_end?.toISOString()).toBe(endDate.toISOString())

    // Correct the end date (upsert on l_end)
    const correctedEndDate = new Date("2025-07-01")
    await updateHerd(fdm, principal_id, l_id_herd, { l_end: correctedEndDate })
    const correctedHerd = await getHerd(fdm, principal_id, l_id_herd)
    expect(correctedHerd.l_end?.toISOString()).toBe(correctedEndDate.toISOString())
  })

  it("should reject removing a herd that still has an animal assigned", async () => {
    const l_id_herd = await addHerd(fdm, principal_id, b_id_farm, {
      l_herd_name: "Melkkoeien",
      l_id_category: "rvo_100",
    })

    await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
      l_id_eartag: "NL900000001",
    })

    await expect(removeHerd(fdm, principal_id, l_id_herd)).rejects.toThrowError(
      "Exception for removeHerd",
    )
  })

  it("should deny access to unauthorized principal", async () => {
    const l_id_herd = await addHerd(fdm, principal_id, b_id_farm, {
      l_herd_name: "Jongvee",
      l_id_category: "rvo_101",
    })

    const invalidUser = "unauthorized_user"
    await expect(getHerd(fdm, invalidUser, l_id_herd)).rejects.toThrowError(
      "Principal does not have permission to perform this action",
    )
  })

  it("should deny access to unauthorized principal for remaining herd functions", async () => {
    const l_id_herd = await addHerd(fdm, principal_id, b_id_farm, {
      l_herd_name: "Jongvee",
      l_id_category: "rvo_101",
    })
    const invalidUser = "unauthorized_user"

    await expect(
      addHerd(fdm, invalidUser, b_id_farm, { l_herd_name: "Should Fail" }),
    ).rejects.toThrowError("Principal does not have permission to perform this action")

    await expect(getHerdsForFarm(fdm, invalidUser, b_id_farm)).rejects.toThrowError(
      "Principal does not have permission to perform this action",
    )

    await expect(
      updateHerd(fdm, invalidUser, l_id_herd, { l_herd_name: "Should Fail" }),
    ).rejects.toThrowError("Principal does not have permission to perform this action")

    await expect(removeHerd(fdm, invalidUser, l_id_herd)).rejects.toThrowError(
      "Principal does not have permission to perform this action",
    )
  })

  it("should reject an unknown animal category", async () => {
    await expect(
      addHerd(fdm, principal_id, b_id_farm, {
        l_herd_name: "Unknown category",
        l_id_category: "missing_category",
      }),
    ).rejects.toThrowError("Exception for addHerd")

    const l_id_herd = await addHerd(fdm, principal_id, b_id_farm, {
      l_herd_name: "Known category",
      l_id_category: "rvo_100",
    })

    await expect(
      updateHerd(fdm, principal_id, l_id_herd, { l_id_category: "missing_category" }),
    ).rejects.toThrowError("Exception for updateHerd")

    await addAnimal(fdm, principal_id, b_id_farm, l_id_herd)
    await expect(
      updateHerd(fdm, principal_id, l_id_herd, { l_id_category: "rvo_550" }),
    ).rejects.toThrowError("Exception for updateHerd")
  })
})
