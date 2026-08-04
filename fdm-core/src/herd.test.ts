import { beforeEach, describe, expect, inject, it } from "vitest"
import type { FdmType } from "./fdm.types"
import { addFarm } from "./farm"
import { createFdmServer } from "./fdm-server"
import { addHerd, getHerd, getHerdsForFarm, removeHerd, updateHerd } from "./herd"

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
      l_herd_category: "rvo_100",
    })

    expect(l_id_herd).toBeDefined()

    const herd = await getHerd(fdm, principal_id, l_id_herd)
    expect(herd.l_herd_name).toBe("Melkkoeien")
    expect(herd.l_herd_category).toBe("rvo_100")
    expect(herd.b_id_farm).toBe(b_id_farm)

    await updateHerd(fdm, principal_id, l_id_herd, {
      l_herd_name: "Melkkoeien Groep A",
    })

    const updated = await getHerd(fdm, principal_id, l_id_herd)
    expect(updated.l_herd_name).toBe("Melkkoeien Groep A")

    const herds = await getHerdsForFarm(fdm, principal_id, b_id_farm)
    expect(herds.length).toBe(1)
    expect(herds[0].l_id_herd).toBe(l_id_herd)
  })

  it("should remove a herd", async () => {
    const l_id_herd = await addHerd(fdm, principal_id, b_id_farm, {
      l_herd_name: "Jongvee",
      l_herd_category: "rvo_101",
    })

    await removeHerd(fdm, principal_id, l_id_herd)

    const herds = await getHerdsForFarm(fdm, principal_id, b_id_farm)
    expect(herds.length).toBe(0)
  })

  it("should deny access to unauthorized principal", async () => {
    const l_id_herd = await addHerd(fdm, principal_id, b_id_farm, {
      l_herd_name: "Jongvee",
      l_herd_category: "rvo_101",
    })

    const invalidUser = "unauthorized_user"
    await expect(getHerd(fdm, invalidUser, l_id_herd)).rejects.toThrowError(
      "Principal does not have permission to perform this action",
    )
  })
})
