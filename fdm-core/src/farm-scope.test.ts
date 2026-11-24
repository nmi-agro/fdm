import { getAnimalCategoriesCatalogue } from "@nmi-agro/fdm-data"
import { beforeEach, describe, expect, inject, it } from "vitest"
import type { FdmType } from "./fdm.types"
import { enableAnimalCategoryCatalogue, syncAnimalCategoryCatalogueArray } from "./catalogues"
import { addFarm } from "./farm"
import { assertSameFarm, getFarmOf, lockFarmOf } from "./farm-scope"
import { createFdmServer } from "./fdm-server"
import { addHerd } from "./herd"

describe("Farm scope", () => {
  let fdm: FdmType
  const principal_id = "farm_scope_principal"
  let b_id_farm: string
  let otherFarm: string
  let l_id_herd: string
  let otherHerd: string

  beforeEach(async () => {
    fdm = createFdmServer(
      inject("host"),
      inject("port"),
      inject("user"),
      inject("password"),
      inject("database"),
    )
    await syncAnimalCategoryCatalogueArray(fdm, await getAnimalCategoriesCatalogue("rvo"))
    b_id_farm = await addFarm(fdm, principal_id, "Scope Farm", "123456", "Weg 1", "1234AB")
    otherFarm = await addFarm(fdm, principal_id, "Other Scope Farm", "654321", "Weg 2", "4321BA")
    for (const farm of [b_id_farm, otherFarm]) {
      await enableAnimalCategoryCatalogue(fdm, principal_id, farm, "rvo")
    }
    l_id_herd = await addHerd(fdm, principal_id, b_id_farm, { l_id_category: "rvo_100" })
    otherHerd = await addHerd(fdm, principal_id, otherFarm, { l_id_category: "rvo_100" })
  })

  it("finds the farm of a record by its ID column", async () => {
    expect(await getFarmOf(fdm, { l_id_herd })).toBe(b_id_farm)
    expect(await getFarmOf(fdm, { l_id_herd: "unknown" })).toBeUndefined()
  })

  it("checks that two records belong to the same farm", async () => {
    const sameFarmHerd = await addHerd(fdm, principal_id, b_id_farm, { l_id_category: "rvo_100" })
    await assertSameFarm(fdm, { l_id_herd }, { l_id_herd: sameFarmHerd })
    await expect(assertSameFarm(fdm, { l_id_herd }, { l_id_herd: otherHerd })).rejects.toThrow(
      "belongs to another farm",
    )
    await expect(assertSameFarm(fdm, { l_id_herd }, { f_id_batch: "unknown" })).rejects.toThrow(
      "f_id_batch unknown does not exist",
    )
  })

  it("locks the farm of a record, and nothing for an unknown record", async () => {
    await fdm.transaction(async (tx) => {
      expect(await lockFarmOf(tx, { l_id_herd })).toBe(b_id_farm)
      expect(await lockFarmOf(tx, { l_id_animal: "unknown" })).toBeUndefined()
    })
  })
})
