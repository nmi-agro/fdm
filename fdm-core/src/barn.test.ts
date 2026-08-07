import { beforeEach, describe, expect, inject, it } from "vitest"
import { getAnimalCategoriesCatalogue } from "@nmi-agro/fdm-data"
import type { FdmType } from "./fdm.types"
import {
  addBarn,
  addHousing,
  getBarn,
  getBarnsForFarm,
  getHousingForFarm,
  getHousingForHerd,
  removeBarn,
  removeHousing,
  updateBarn,
  updateHousing,
} from "./barn"
import { addFarm } from "./farm"
import { createFdmServer } from "./fdm-server"
import { addHerd } from "./herd"
import { syncAnimalCategoryCatalogueArray } from "./catalogues"

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
    await syncAnimalCategoryCatalogueArray(fdm, await getAnimalCategoriesCatalogue("rvo"))
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

  it("should record and correct that a barn was decommissioned via b_barn_decommissioning_date", async () => {
    const b_id_barn = await addBarn(fdm, principal_id, b_id_farm, {
      b_barn_name: "Barn to decommission",
      b_floor_area: 400,
    })

    const decommissionDate = new Date("2025-06-01")
    await updateBarn(fdm, principal_id, b_id_barn, {
      b_barn_decommissioning_date: decommissionDate,
    })

    const barn = await getBarn(fdm, principal_id, b_id_barn)
    expect(barn.b_barn_decommissioning_date?.toISOString()).toBe(decommissionDate.toISOString())

    // Correct the decommissioning date (upsert)
    const correctedDate = new Date("2025-07-01")
    await updateBarn(fdm, principal_id, b_id_barn, {
      b_barn_decommissioning_date: correctedDate,
    })
    const correctedBarn = await getBarn(fdm, principal_id, b_id_barn)
    expect(correctedBarn.b_barn_decommissioning_date?.toISOString()).toBe(
      correctedDate.toISOString(),
    )
  })

  it("should reject removing a barn that a herd is or was housed in", async () => {
    const b_id_barn = await addBarn(fdm, principal_id, b_id_farm, {
      b_barn_name: "Housing Barn",
      b_floor_area: 500,
    })
    const l_id_herd = await addHerd(fdm, principal_id, b_id_farm, {
      l_herd_name: "Melkkoeien",
      l_id_category: "rvo_100",
    })

    await addHousing(fdm, principal_id, l_id_herd, b_id_barn, new Date())

    await expect(removeBarn(fdm, principal_id, b_id_barn)).rejects.toThrowError(
      "Exception for removeBarn",
    )
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
      l_id_category: "rvo_100",
    })

    const hStart = new Date("2025-01-01")
    const hEnd = new Date("2025-04-15")
    await addHousing(fdm, principal_id, l_id_herd, b_id_barn, hStart, hEnd)

    const housingRecords = await getHousingForHerd(fdm, principal_id, l_id_herd)
    expect(housingRecords.length).toBe(1)
    expect(housingRecords[0].b_id_barn).toBe(b_id_barn)
    expect(new Date(housingRecords[0].b_housing_end!).toISOString()).toBe(hEnd.toISOString())

    const farmHousing = await getHousingForFarm(fdm, principal_id, b_id_farm)
    expect(farmHousing.length).toBe(1)

    const correctedEnd = new Date("2025-05-01")
    await updateHousing(fdm, principal_id, l_id_herd, b_id_barn, hStart, {
      b_housing_end: correctedEnd,
    })
    expect((await getHousingForHerd(fdm, principal_id, l_id_herd))[0].b_housing_end?.toISOString()).toBe(
      correctedEnd.toISOString(),
    )

    await removeHousing(fdm, principal_id, l_id_herd, b_id_barn, hStart)
    expect(await getHousingForHerd(fdm, principal_id, l_id_herd)).toEqual([])
  })

  it("should reject overlapping housing intervals for the same herd even across barns", async () => {
    const b_id_barn_1 = await addBarn(fdm, principal_id, b_id_farm, { b_barn_name: "Barn A" })
    const b_id_barn_2 = await addBarn(fdm, principal_id, b_id_farm, { b_barn_name: "Barn B" })
    const l_id_herd = await addHerd(fdm, principal_id, b_id_farm, {
      l_herd_name: "Overlap Kudde",
      l_id_category: "rvo_101",
    })

    const firstStart = new Date("2025-01-01T00:00:00.000Z")
    const firstEnd = new Date("2025-01-10T00:00:00.000Z")
    await addHousing(fdm, principal_id, l_id_herd, b_id_barn_1, firstStart, firstEnd)

    await expect(
      addHousing(
        fdm,
        principal_id,
        l_id_herd,
        b_id_barn_2,
        new Date("2025-01-05T00:00:00.000Z"),
        new Date("2025-01-15T00:00:00.000Z"),
      ),
    ).rejects.toThrowError("Exception for addHousing")

    await expect(
      addHousing(
        fdm,
        principal_id,
        l_id_herd,
        b_id_barn_2,
        new Date("2025-01-10T00:00:00.000Z"),
        new Date("2025-01-20T00:00:00.000Z"),
      ),
    ).resolves.not.toThrow()
  })

  it("should reject housing update when interval would overlap another housing interval", async () => {
    const b_id_barn_1 = await addBarn(fdm, principal_id, b_id_farm, { b_barn_name: "Barn C" })
    const b_id_barn_2 = await addBarn(fdm, principal_id, b_id_farm, { b_barn_name: "Barn D" })
    const l_id_herd = await addHerd(fdm, principal_id, b_id_farm, {
      l_herd_name: "Update overlap kudde",
      l_id_category: "rvo_101",
    })

    const firstStart = new Date("2025-02-01T00:00:00.000Z")
    const secondStart = new Date("2025-02-06T00:00:00.000Z")
    await addHousing(
      fdm,
      principal_id,
      l_id_herd,
      b_id_barn_1,
      firstStart,
      new Date("2025-02-05T00:00:00.000Z"),
    )
    await addHousing(
      fdm,
      principal_id,
      l_id_herd,
      b_id_barn_2,
      secondStart,
      new Date("2025-02-10T00:00:00.000Z"),
    )

    await expect(
      updateHousing(fdm, principal_id, l_id_herd, b_id_barn_1, firstStart, {
        b_housing_end: new Date("2025-02-08T00:00:00.000Z"),
      }),
    ).rejects.toThrowError("Exception for updateHousing")
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
      l_id_category: "rvo_100",
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

    const hStart = new Date("2025-01-01")
    await addHousing(fdm, principal_id, l_id_herd, b_id_barn, hStart)

    await expect(getHousingForFarm(fdm, invalidUser, b_id_farm)).rejects.toThrowError(
      "Principal does not have permission to perform this action",
    )

    await expect(
      updateHousing(fdm, invalidUser, l_id_herd, b_id_barn, hStart, {
        b_housing_end: new Date("2025-02-01"),
      }),
    ).rejects.toThrowError("Principal does not have permission to perform this action")

    await expect(removeHousing(fdm, invalidUser, l_id_herd, b_id_barn, hStart)).rejects.toThrowError(
      "Principal does not have permission to perform this action",
    )
  })
})
