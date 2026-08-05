import { beforeEach, describe, expect, inject, it } from "vitest"
import type { FdmType } from "./fdm.types"
import {
  addBarn,
  addHousing,
  getBarn,
  getBarnsForFarm,
  getHousingForHerd,
  removeBarn,
  updateBarn,
} from "./barn"
import { addFarm } from "./farm"
import { createFdmServer } from "./fdm-server"
import { addHerd } from "./herd"

describe("Barn Domain", () => {
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
      "Test Farm for Barns",
      "123456",
      "Farm Street 1",
      "1234AB",
    )
  })

  it("should create, read, update, list, and remove barns", async () => {
    const b_id_barn = await addBarn(fdm, principal_id, b_id_farm, {
      b_barn_name: "Barn 1",
      b_floor_area: 500,
    })

    expect(b_id_barn).toBeDefined()

    const barn = await getBarn(fdm, principal_id, b_id_barn)
    expect(barn.b_floor_area).toBe(500)

    await updateBarn(fdm, principal_id, b_id_barn, {
      b_floor_area: 600,
    })

    const updated = await getBarn(fdm, principal_id, b_id_barn)
    expect(updated.b_floor_area).toBe(600)

    const barns = await getBarnsForFarm(fdm, principal_id, b_id_farm)
    expect(barns.length).toBe(1)

    await removeBarn(fdm, principal_id, b_id_barn)
    const activeBarns = await getBarnsForFarm(fdm, principal_id, b_id_farm)
    expect(activeBarns.length).toBe(0)
  })

  it("should handle herd housing action with housing end date and update barn properties", async () => {
    const polygon = {
      type: "Polygon" as const,
      coordinates: [
        [
          [5.1, 52.1],
          [5.2, 52.1],
          [5.2, 52.2],
          [5.1, 52.2],
          [5.1, 52.1],
        ],
      ],
    }

    const b_id_barn = await addBarn(fdm, principal_id, b_id_farm, {
      b_barn_name: "Barn 1",
      b_floor_area: 500,
      b_barn_geometry: polygon,
    })

    await updateBarn(fdm, principal_id, b_id_barn, {
      b_barn_name: "Barn 1 Updated",
      b_floor_area: 750,
      b_barn_geometry: polygon,
    })

    const updatedBarn = await getBarn(fdm, principal_id, b_id_barn)
    expect(updatedBarn.b_barn_name).toBe("Barn 1 Updated")
    expect(updatedBarn.b_floor_area).toBe(750)

    const l_id_herd = await addHerd(fdm, principal_id, b_id_farm, {
      l_herd_name: "Melkkoeien",
      l_herd_category: "rvo_100",
    })

    const hStart = new Date("2025-01-01")
    const hEnd = new Date("2025-04-15")
    await addHousing(fdm, principal_id, l_id_herd, b_id_barn, hStart, hEnd)

    const housingRecords = await getHousingForHerd(fdm, principal_id, l_id_herd)
    expect(housingRecords.length).toBe(1)
    expect(housingRecords[0].b_id_barn).toBe(b_id_barn)
    expect(new Date(housingRecords[0].b_housing_end!).toISOString()).toBe(hEnd.toISOString())
  })

  it("should deny access to unauthorized principal", async () => {
    const b_id_barn = await addBarn(fdm, principal_id, b_id_farm, {
      b_floor_area: 500,
    })

    const invalidUser = "unauthorized_user"
    await expect(getBarn(fdm, invalidUser, b_id_barn)).rejects.toThrowError(
      "Principal does not have permission to perform this action",
    )
  })

  it("should deny access to unauthorized principal for remaining barn functions", async () => {
    const b_id_barn = await addBarn(fdm, principal_id, b_id_farm, {
      b_floor_area: 500,
    })
    const l_id_herd = await addHerd(fdm, principal_id, b_id_farm, {
      l_herd_name: "Melkkoeien",
      l_herd_category: "rvo_100",
    })
    const invalidUser = "unauthorized_user"

    await expect(
      addBarn(fdm, invalidUser, b_id_farm, { b_floor_area: 500 }),
    ).rejects.toThrowError("Principal does not have permission to perform this action")

    await expect(getBarnsForFarm(fdm, invalidUser, b_id_farm)).rejects.toThrowError(
      "Principal does not have permission to perform this action",
    )

    await expect(
      updateBarn(fdm, invalidUser, b_id_barn, { b_floor_area: 600 }),
    ).rejects.toThrowError("Principal does not have permission to perform this action")

    await expect(removeBarn(fdm, invalidUser, b_id_barn)).rejects.toThrowError(
      "Principal does not have permission to perform this action",
    )

    await expect(
      addHousing(fdm, invalidUser, l_id_herd, b_id_barn, new Date()),
    ).rejects.toThrowError("Principal does not have permission to perform this action")

    await expect(getHousingForHerd(fdm, invalidUser, l_id_herd)).rejects.toThrowError(
      "Principal does not have permission to perform this action",
    )
  })
})
