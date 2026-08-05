import { beforeEach, describe, expect, inject, it } from "vitest"
import type { FdmType } from "./fdm.types"
import { addFarm } from "./farm"
import { createFdmServer } from "./fdm-server"
import { addGrazing, getGrazingForFarm, getGrazingForHerd } from "./grazing"
import { addHerd } from "./herd"

describe("Grazing Domain", () => {
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
      "Test Farm for Grazing Domain",
      "123456",
      "Pasture Path 1",
      "1234AB",
    )

    l_id_herd = await addHerd(fdm, principal_id, b_id_farm, {
      l_herd_name: "Melkkoeien",
      l_herd_category: "rvo_100",
    })
  })

  it("should record grazing action and retrieve for herd and farm", async () => {
    const startDate = new Date("2025-05-15")
    await addGrazing(fdm, principal_id, l_id_herd, startDate, {
      l_grazing_days: 120,
      l_grazing_hours: 8,
      l_grazing_area: 25,
      l_grazing_type: "full",
    })

    const herdGrazing = await getGrazingForHerd(fdm, principal_id, l_id_herd)
    expect(herdGrazing.length).toBe(1)
    expect(herdGrazing[0].l_grazing_days).toBe(120)
    expect(herdGrazing[0].l_grazing_hours).toBe(8)
    expect(herdGrazing[0].l_grazing_type).toBe("full")

    const farmGrazing = await getGrazingForFarm(fdm, principal_id, b_id_farm)
    expect(farmGrazing.length).toBe(1)
  })

  it("should filter grazing actions by timeframe and handle farm without herds", async () => {
    const d1 = new Date("2025-05-01")
    const d2 = new Date("2025-06-01")

    await addGrazing(fdm, principal_id, l_id_herd, d1, { l_grazing_days: 10 })
    await addGrazing(fdm, principal_id, l_id_herd, d2, { l_grazing_days: 20 })

    const herdStartOnly = await getGrazingForHerd(fdm, principal_id, l_id_herd, {
      start: new Date("2025-05-15"),
      end: undefined,
    })
    expect(herdStartOnly.length).toBe(1)
    expect(herdStartOnly[0].l_grazing_days).toBe(20)

    const herdEndOnly = await getGrazingForHerd(fdm, principal_id, l_id_herd, {
      start: undefined,
      end: new Date("2025-05-15"),
    })
    expect(herdEndOnly.length).toBe(1)
    expect(herdEndOnly[0].l_grazing_days).toBe(10)

    const farmStartOnly = await getGrazingForFarm(fdm, principal_id, b_id_farm, {
      start: new Date("2025-05-15"),
      end: undefined,
    })
    expect(farmStartOnly.length).toBe(1)

    const farmEndOnly = await getGrazingForFarm(fdm, principal_id, b_id_farm, {
      start: undefined,
      end: new Date("2025-05-15"),
    })
    expect(farmEndOnly.length).toBe(1)

    const farm2 = await addFarm(fdm, principal_id, "Farm 2", "654321", "Pasture 2", "1234AB")
    const emptyFarm = await getGrazingForFarm(fdm, principal_id, farm2)
    expect(emptyFarm).toEqual([])
  })

  it("should deny access to unauthorized principal", async () => {
    const invalidUser = "unauthorized_user"
    await expect(addGrazing(fdm, invalidUser, l_id_herd, new Date())).rejects.toThrowError(
      "Principal does not have permission to perform this action",
    )
  })
})
