import { beforeEach, describe, expect, inject, it } from "vitest"
import type { FdmType } from "./fdm.types"
import { addFarm } from "./farm"
import { createFdmServer } from "./fdm-server"
import { addField } from "./field"
import {
  addGrazing,
  getGrazing,
  getGrazingForFarm,
  getGrazingForField,
  getGrazingForHerd,
  removeGrazing,
  updateGrazing,
} from "./grazing"
import { getGrazingIntention, setGrazingIntention } from "./grazing_intention"
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
      l_grazing_hours: 8,
      l_grazing_area: 25,
      l_grazing_type: "full",
    })

    const herdGrazing = await getGrazingForHerd(fdm, principal_id, l_id_herd)
    expect(herdGrazing.length).toBe(1)
    expect(herdGrazing[0].l_grazing_hours).toBe(8)
    expect(herdGrazing[0].l_grazing_area).toBe(25)
    expect(herdGrazing[0].l_grazing_type).toBe("full")

    const farmGrazing = await getGrazingForFarm(fdm, principal_id, b_id_farm)
    expect(farmGrazing.length).toBe(1)
  })

  it("should set grazing intention to true when first grazing is added for a farm year", async () => {
    const grazingDate = new Date("2025-05-15T08:00:00.000Z")

    await setGrazingIntention(fdm, principal_id, b_id_farm, 2025, false)
    expect(await getGrazingIntention(fdm, principal_id, b_id_farm, 2025)).toBe(false)

    await addGrazing(fdm, principal_id, l_id_herd, grazingDate, {
      l_grazing_type: "full",
    })

    expect(await getGrazingIntention(fdm, principal_id, b_id_farm, 2025)).toBe(true)
  })

  it("should not overwrite other years when setting first-grazing intention", async () => {
    await setGrazingIntention(fdm, principal_id, b_id_farm, 2024, false)
    await addGrazing(fdm, principal_id, l_id_herd, new Date("2025-06-01T08:00:00.000Z"))

    expect(await getGrazingIntention(fdm, principal_id, b_id_farm, 2025)).toBe(true)
    expect(await getGrazingIntention(fdm, principal_id, b_id_farm, 2024)).toBe(false)
  })

  it("should only auto-set intention on the first grazing in a year", async () => {
    await addGrazing(fdm, principal_id, l_id_herd, new Date("2025-01-05T08:00:00.000Z"), {
      l_grazing_end: new Date("2025-01-06T08:00:00.000Z"),
    })
    expect(await getGrazingIntention(fdm, principal_id, b_id_farm, 2025)).toBe(true)

    await setGrazingIntention(fdm, principal_id, b_id_farm, 2025, false)
    await addGrazing(fdm, principal_id, l_id_herd, new Date("2025-02-05T08:00:00.000Z"), {
      l_grazing_end: new Date("2025-02-06T08:00:00.000Z"),
    })

    expect(await getGrazingIntention(fdm, principal_id, b_id_farm, 2025)).toBe(false)
  })

  it("should record grazing for a field on the same farm and store the b_id link", async () => {
    const b_id = await addField(
      fdm,
      principal_id,
      b_id_farm,
      "Test Field",
      "source1",
      {
        type: "Polygon" as const,
        coordinates: [
          [
            [-1, -1],
            [-1, 1],
            [1, 1],
            [1, -1],
            [-1, -1],
          ],
        ],
      },
      new Date(),
      "nl_01",
    )

    await addGrazing(fdm, principal_id, l_id_herd, new Date("2025-05-15"), { b_id })

    const herdGrazing = await getGrazingForHerd(fdm, principal_id, l_id_herd)
    expect(herdGrazing.length).toBe(1)
    expect(herdGrazing[0].b_id).toBe(b_id)

    const fieldGrazing = await getGrazingForField(fdm, principal_id, b_id)
    expect(fieldGrazing.length).toBe(1)
    expect(fieldGrazing[0].l_id_herd).toBe(l_id_herd)
  })

  it("should reject overlapping grazing intervals for the same herd", async () => {
    const firstStart = new Date("2025-04-10T00:00:00.000Z")
    const firstEnd = new Date("2025-04-20T00:00:00.000Z")
    await addGrazing(fdm, principal_id, l_id_herd, firstStart, {
      l_grazing_end: firstEnd,
    })

    await expect(
      addGrazing(fdm, principal_id, l_id_herd, new Date("2025-04-15T00:00:00.000Z"), {
        l_grazing_end: new Date("2025-04-25T00:00:00.000Z"),
        l_grazing_type: "full",
        l_grazing_hours: 24,
      }),
    ).rejects.toThrowError("Exception for addGrazing")

    const secondStart = new Date("2025-04-20T00:00:00.000Z")
    await addGrazing(fdm, principal_id, l_id_herd, secondStart, {
      l_grazing_end: new Date("2025-04-25T00:00:00.000Z"),
    })
    const grazingRecords = await getGrazingForHerd(fdm, principal_id, l_id_herd)
    const secondRecord = grazingRecords.find(
      (record) => record.l_grazing_start.getTime() === secondStart.getTime(),
    )
    expect(secondRecord).toBeDefined()

    await expect(
      updateGrazing(fdm, principal_id, secondRecord!.l_id_grazing, {
        l_grazing_start: new Date("2025-04-15T00:00:00.000Z"),
      }),
    ).rejects.toThrowError("Exception for updateGrazing")
  })

  it("should reject grazing for a field belonging to a different farm", async () => {
    const otherFarmId = await addFarm(
      fdm,
      principal_id,
      "Other Farm for Grazing",
      "654321",
      "Other Pasture 1",
      "4321BA",
    )
    const otherFieldId = await addField(
      fdm,
      principal_id,
      otherFarmId,
      "Other Farm Field",
      "source2",
      {
        type: "Polygon" as const,
        coordinates: [
          [
            [-2, -2],
            [-2, 2],
            [2, 2],
            [2, -2],
            [-2, -2],
          ],
        ],
      },
      new Date(),
      "nl_01",
    )

    await expect(
      addGrazing(fdm, principal_id, l_id_herd, new Date("2025-05-15"), {
        b_id: otherFieldId,
      }),
    ).rejects.toThrowError("Exception for addGrazing")
  })

  it("should filter grazing actions by timeframe and handle farm without herds", async () => {
    const d1 = new Date("2025-05-01")
    const d2 = new Date("2025-06-01")

    await addGrazing(fdm, principal_id, l_id_herd, d1, {
      l_grazing_end: new Date("2025-05-02"),
      l_grazing_area: 10,
    })
    await addGrazing(fdm, principal_id, l_id_herd, d2, {
      l_grazing_end: new Date("2025-06-02"),
      l_grazing_area: 20,
    })

    const herdStartOnly = await getGrazingForHerd(fdm, principal_id, l_id_herd, {
      start: new Date("2025-05-15"),
      end: undefined,
    })
    expect(herdStartOnly.length).toBe(1)
    expect(herdStartOnly[0].l_grazing_area).toBe(20)

    const herdEndOnly = await getGrazingForHerd(fdm, principal_id, l_id_herd, {
      start: undefined,
      end: new Date("2025-05-15"),
    })
    expect(herdEndOnly.length).toBe(1)
    expect(herdEndOnly[0].l_grazing_area).toBe(10)

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

    const herdBoth = await getGrazingForHerd(fdm, principal_id, l_id_herd, {
      start: new Date("2025-04-15"),
      end: new Date("2025-05-15"),
    })
    expect(herdBoth.length).toBe(1)
    expect(herdBoth[0].l_grazing_area).toBe(10)

    const farmBoth = await getGrazingForFarm(fdm, principal_id, b_id_farm, {
      start: new Date("2025-04-15"),
      end: new Date("2025-05-15"),
    })
    expect(farmBoth.length).toBe(1)

    const farm2 = await addFarm(fdm, principal_id, "Farm 2", "654321", "Pasture 2", "1234AB")
    const emptyFarm = await getGrazingForFarm(fdm, principal_id, farm2)
    expect(emptyFarm).toEqual([])
  })

  it("should correct and remove a grazing record", async () => {
    const startDate = new Date("2025-05-15")
    await addGrazing(fdm, principal_id, l_id_herd, startDate, {
      l_grazing_hours: 8,
      l_grazing_area: 25,
      l_grazing_type: "full",
    })

    const [grazingRecord] = await getGrazingForHerd(fdm, principal_id, l_id_herd)
    expect(grazingRecord.l_grazing_area).toBe(25)

    const single = await getGrazing(fdm, principal_id, grazingRecord.l_id_grazing)
    expect(single.l_id_grazing).toBe(grazingRecord.l_id_grazing)
    expect(single.l_grazing_area).toBe(25)

    await updateGrazing(fdm, principal_id, grazingRecord.l_id_grazing, {
      l_grazing_area: 30,
      l_grazing_type: "partial",
    })

    const [updated] = await getGrazingForHerd(fdm, principal_id, l_id_herd)
    expect(updated.l_grazing_area).toBe(30)
    expect(updated.l_grazing_type).toBe("partial")

    await removeGrazing(fdm, principal_id, grazingRecord.l_id_grazing)
    const remaining = await getGrazingForHerd(fdm, principal_id, l_id_herd)
    expect(remaining.length).toBe(0)

    await expect(getGrazing(fdm, principal_id, grazingRecord.l_id_grazing)).rejects.toThrowError(
      "Exception for getGrazing",
    )
  })

  it("should deny access to unauthorized principal", async () => {
    const invalidUser = "unauthorized_user"
    await expect(addGrazing(fdm, invalidUser, l_id_herd, new Date())).rejects.toThrowError(
      "Principal does not have permission to perform this action",
    )
  })

  it("should deny access to unauthorized principal for remaining grazing functions", async () => {
    const invalidUser = "unauthorized_user"

    const b_id = await addField(
      fdm,
      principal_id,
      b_id_farm,
      "Test Field",
      "source3",
      {
        type: "Polygon" as const,
        coordinates: [
          [
            [-3, -3],
            [-3, 3],
            [3, 3],
            [3, -3],
            [-3, -3],
          ],
        ],
      },
      new Date(),
      "nl_01",
    )

    await addGrazing(fdm, principal_id, l_id_herd, new Date("2025-05-15"), {
      b_id,
      l_grazing_area: 10,
    })
    const [grazingRecord] = await getGrazingForHerd(fdm, principal_id, l_id_herd)

    await expect(getGrazingForHerd(fdm, invalidUser, l_id_herd)).rejects.toThrowError(
      "Principal does not have permission to perform this action",
    )

    await expect(getGrazingForFarm(fdm, invalidUser, b_id_farm)).rejects.toThrowError(
      "Principal does not have permission to perform this action",
    )

    await expect(getGrazingForField(fdm, invalidUser, b_id)).rejects.toThrowError(
      "Principal does not have permission to perform this action",
    )

    await expect(getGrazing(fdm, invalidUser, grazingRecord.l_id_grazing)).rejects.toThrowError(
      "Principal does not have permission to perform this action",
    )

    await expect(
      updateGrazing(fdm, invalidUser, grazingRecord.l_id_grazing, { l_grazing_area: 20 }),
    ).rejects.toThrowError("Principal does not have permission to perform this action")

    await expect(
      removeGrazing(fdm, invalidUser, grazingRecord.l_id_grazing),
    ).rejects.toThrowError("Principal does not have permission to perform this action")
  })
})
