import { getAnimalCategoriesCatalogue } from "@nmi-agro/fdm-data"
import { beforeEach, describe, expect, inject, it } from "vitest"
import type { FdmType } from "./fdm.types"
import { syncAnimalCategoryCatalogueArray } from "./catalogues"
import { addFarm } from "./farm"
import { createFdmServer } from "./fdm-server"
import { addField } from "./field"
import {
  addGrazing,
  addGrazings,
  getGrazedAreaForFarm,
  getGrazing,
  getGrazingCalendarForFarm,
  getGrazingForFarm,
  getGrazingForField,
  getGrazingForHerd,
  getGrazingZonesForField,
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
    await syncAnimalCategoryCatalogueArray(fdm, await getAnimalCategoriesCatalogue("rvo"))
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
      l_id_category: "rvo_100",
    })
  })

  it("should record grazing action and retrieve for herd and farm", async () => {
    const startDate = new Date("2025-05-15")
    await addGrazing(fdm, principal_id, l_id_herd, startDate, {
      l_grazing_hours: 8,
      l_grazing_area: 25,
    })

    const herdGrazing = await getGrazingForHerd(fdm, principal_id, l_id_herd)
    expect(herdGrazing.length).toBe(1)
    expect(herdGrazing[0].l_grazing_hours).toBe(8)
    expect(herdGrazing[0].l_grazing_area).toBe(25)
    // Without a field the recorded area is the grazed area
    expect(herdGrazing[0].l_grazing_area_grazed).toBe(25)
    expect(herdGrazing[0].l_grazing_geometry_zone).toBeNull()

    const farmGrazing = await getGrazingForFarm(fdm, principal_id, b_id_farm)
    expect(farmGrazing.length).toBe(1)
  })

  it("should set grazing intention to true when first grazing is added for a farm year", async () => {
    const grazingDate = new Date("2025-05-15T08:00:00.000Z")

    await setGrazingIntention(fdm, principal_id, b_id_farm, 2025, false)
    expect(await getGrazingIntention(fdm, principal_id, b_id_farm, 2025)).toBe(false)

    await addGrazing(fdm, principal_id, l_id_herd, grazingDate)

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

  it("should set the intention when a correction moves the first grazing into a year", async () => {
    const oneDay = (date: string) => ({
      l_grazing_start: new Date(`${date}T00:00:00.000Z`),
      l_grazing_end: new Date(`${date}T12:00:00.000Z`),
    })
    await addGrazing(fdm, principal_id, l_id_herd, oneDay("2025-05-01").l_grazing_start, {
      l_grazing_end: oneDay("2025-05-01").l_grazing_end,
    })
    const [grazing] = await getGrazingForHerd(fdm, principal_id, l_id_herd)
    await setGrazingIntention(fdm, principal_id, b_id_farm, 2025, false)
    await setGrazingIntention(fdm, principal_id, b_id_farm, 2026, false)

    // A correction within the same year leaves the intention as the farmer set it
    await updateGrazing(fdm, principal_id, grazing.l_id_grazing, oneDay("2025-05-02"))
    expect(await getGrazingIntention(fdm, principal_id, b_id_farm, 2025)).toBe(false)

    // Moving it into 2026, which has no grazing yet, turns 2026 on
    await updateGrazing(fdm, principal_id, grazing.l_id_grazing, oneDay("2026-05-02"))
    expect(await getGrazingIntention(fdm, principal_id, b_id_farm, 2026)).toBe(true)

    // Moving another grazing into 2026 is not the first one there
    await addGrazing(fdm, principal_id, l_id_herd, oneDay("2025-06-01").l_grazing_start, {
      l_grazing_end: oneDay("2025-06-01").l_grazing_end,
    })
    await setGrazingIntention(fdm, principal_id, b_id_farm, 2026, false)
    const second = (await getGrazingForHerd(fdm, principal_id, l_id_herd)).find(
      (g) => g.l_id_grazing !== grazing.l_id_grazing,
    )
    await updateGrazing(fdm, principal_id, second!.l_id_grazing, oneDay("2026-06-01"))
    expect(await getGrazingIntention(fdm, principal_id, b_id_farm, 2026)).toBe(false)
  })

  it("should reject grazing hours outside 0 to 24", async () => {
    const start = new Date("2025-05-15T00:00:00.000Z")
    for (const hours of [0, -1, 25, Number.NaN]) {
      await expect(
        addGrazing(fdm, principal_id, l_id_herd, start, { l_grazing_hours: hours }),
      ).rejects.toMatchObject({
        cause: { message: expect.stringContaining("Invalid grazing hours") },
      })
    }
    await expect(
      addGrazings(fdm, principal_id, [{ l_id_herd, l_grazing_start: start, l_grazing_hours: 30 }]),
    ).rejects.toMatchObject({
      cause: { message: expect.stringContaining("Invalid grazing hours") },
    })

    await addGrazing(fdm, principal_id, l_id_herd, start, { l_grazing_hours: 24 })
    const [grazing] = await getGrazingForHerd(fdm, principal_id, l_id_herd)
    await expect(
      updateGrazing(fdm, principal_id, grazing.l_id_grazing, { l_grazing_hours: 24.5 }),
    ).rejects.toMatchObject({
      cause: { message: expect.stringContaining("Invalid grazing hours") },
    })
    // Clearing the hours is allowed
    await updateGrazing(fdm, principal_id, grazing.l_id_grazing, { l_grazing_hours: null })
    expect((await getGrazing(fdm, principal_id, grazing.l_id_grazing)).l_grazing_hours).toBeNull()
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

  it("should allow overlapping grazing intervals for the same herd on DIFFERENT fields, but reject on SAME field or herd-level", async () => {
    const field1 = await addField(
      fdm,
      principal_id,
      b_id_farm,
      "Field 1",
      "src_f1",
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
    const field2 = await addField(
      fdm,
      principal_id,
      b_id_farm,
      "Field 2",
      "src_f2",
      {
        type: "Polygon" as const,
        coordinates: [
          [
            [2, 2],
            [2, 4],
            [4, 4],
            [4, 2],
            [2, 2],
          ],
        ],
      },
      new Date(),
      "nl_01",
    )

    const start = new Date("2025-07-01T00:00:00.000Z")
    const end = new Date("2025-07-10T00:00:00.000Z")

    // Grazing on field 1
    await addGrazing(fdm, principal_id, l_id_herd, start, {
      b_id: field1,
      l_grazing_end: end,
    })

    // Concurrent grazing on field 2 for same herd MUST be accepted
    await expect(
      addGrazing(fdm, principal_id, l_id_herd, start, {
        b_id: field2,
        l_grazing_end: end,
      }),
    ).resolves.not.toThrow()

    // Concurrent grazing on same field 1 MUST be rejected
    await expect(
      addGrazing(fdm, principal_id, l_id_herd, new Date("2025-07-05T00:00:00.000Z"), {
        b_id: field1,
        l_grazing_end: new Date("2025-07-15T00:00:00.000Z"),
      }),
    ).rejects.toThrowError("Exception for addGrazing")

    // Concurrent grazing with herd-level (b_id is null) MUST be rejected
    await expect(
      addGrazing(fdm, principal_id, l_id_herd, new Date("2025-07-05T00:00:00.000Z"), {
        l_grazing_end: new Date("2025-07-15T00:00:00.000Z"),
      }),
    ).rejects.toThrowError("Exception for addGrazing")
  })

  it("should bulk insert grazing records via addGrazings atomically with intention side-effect", async () => {
    const field1 = await addField(
      fdm,
      principal_id,
      b_id_farm,
      "Field Bulk 1",
      "src_fb1",
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

    await setGrazingIntention(fdm, principal_id, b_id_farm, 2027, false)
    expect(await getGrazingIntention(fdm, principal_id, b_id_farm, 2027)).toBe(false)

    await addGrazings(fdm, principal_id, [
      {
        l_id_herd,
        b_id: field1,
        l_grazing_start: new Date("2027-05-01T00:00:00.000Z"),
        l_grazing_end: new Date("2027-05-04T00:00:00.000Z"),
        l_grazing_hours: 8,
      },
      {
        l_id_herd,
        b_id: field1,
        l_grazing_start: new Date("2027-05-10T00:00:00.000Z"),
        l_grazing_end: new Date("2027-05-14T00:00:00.000Z"),
        l_grazing_hours: 8,
      },
    ])

    const records = await getGrazingForHerd(fdm, principal_id, l_id_herd, {
      start: new Date("2027-01-01T00:00:00.000Z"),
      end: new Date("2027-12-31T23:59:59.999Z"),
    })
    expect(records.length).toBe(2)
    expect(await getGrazingIntention(fdm, principal_id, b_id_farm, 2027)).toBe(true)

    // Pre-flight rejection: every row is checked before the first write, so when one row is
    // invalid none are inserted
    const countBefore = (await getGrazingForFarm(fdm, principal_id, b_id_farm)).length
    await expect(
      addGrazings(fdm, principal_id, [
        {
          l_id_herd,
          b_id: field1,
          l_grazing_start: new Date("2027-06-01T00:00:00.000Z"),
          l_grazing_end: new Date("2027-06-05T00:00:00.000Z"),
        },
        {
          l_id_herd,
          b_id: "non-existent-field",
          l_grazing_start: new Date("2027-06-10T00:00:00.000Z"),
        },
      ]),
    ).rejects.toThrowError("Exception for addGrazings")

    const countAfter = (await getGrazingForFarm(fdm, principal_id, b_id_farm)).length
    expect(countAfter).toBe(countBefore)
  })

  it("should retrieve grazing calendar entries joined with herd and field details", async () => {
    const field = await addField(
      fdm,
      principal_id,
      b_id_farm,
      "Perceel De Hoek",
      "src_hoek",
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

    await addGrazing(fdm, principal_id, l_id_herd, new Date("2025-08-01T00:00:00.000Z"), {
      b_id: field,
      l_grazing_end: new Date("2025-08-04T00:00:00.000Z"),
      l_grazing_hours: 8,
    })

    const calendar = await getGrazingCalendarForFarm(fdm, principal_id, b_id_farm, {
      start: new Date("2025-08-01T00:00:00.000Z"),
      end: new Date("2025-08-31T23:59:59.999Z"),
    })

    expect(calendar.length).toBe(1)
    expect(calendar[0].l_herd_name).toBe("Melkkoeien")
    expect(calendar[0].l_id_category).toBe("rvo_100")
    expect(calendar[0].l_category).toBe("100 - Melk- en kalfkoeien")
    expect(calendar[0].l_lsu).toBe(1)
    expect(calendar[0].b_name).toBe("Perceel De Hoek")
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
    })

    const [grazingRecord] = await getGrazingForHerd(fdm, principal_id, l_id_herd)
    expect(grazingRecord.l_grazing_area).toBe(25)

    const single = await getGrazing(fdm, principal_id, grazingRecord.l_id_grazing)
    expect(single.l_id_grazing).toBe(grazingRecord.l_id_grazing)
    expect(single.l_grazing_area).toBe(25)

    await updateGrazing(fdm, principal_id, grazingRecord.l_id_grazing, {
      l_grazing_area: 30,
    })

    const [updated] = await getGrazingForHerd(fdm, principal_id, l_id_herd)
    expect(updated.l_grazing_area).toBe(30)

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

    await expect(removeGrazing(fdm, invalidUser, grazingRecord.l_id_grazing)).rejects.toThrowError(
      "Principal does not have permission to perform this action",
    )
    await expect(getGrazingZonesForField(fdm, invalidUser, b_id)).rejects.toThrowError(
      "Principal does not have permission to perform this action",
    )
    await expect(getGrazedAreaForFarm(fdm, invalidUser, b_id_farm)).rejects.toThrowError(
      "Principal does not have permission to perform this action",
    )
  })
})

describe("Grazing zones", () => {
  let fdm: FdmType
  let principal_id: string
  let b_id_farm: string
  let l_id_herd: string
  let b_id: string
  let fieldArea: number

  /** Rectangle between two longitudes on the synthetic test field (latitude 52.00-52.01). */
  const strip = (lonMin: number, lonMax: number) => ({
    type: "Polygon" as const,
    coordinates: [
      [
        [lonMin, 52.0],
        [lonMin, 52.01],
        [lonMax, 52.01],
        [lonMax, 52.0],
        [lonMin, 52.0],
      ],
    ],
  })

  const day = (d: number) => new Date(Date.UTC(2025, 5, d))

  beforeEach(async () => {
    fdm = createFdmServer(
      inject("host"),
      inject("port"),
      inject("user"),
      inject("password"),
      inject("database"),
    )
    await syncAnimalCategoryCatalogueArray(fdm, await getAnimalCategoriesCatalogue("rvo"))
    principal_id = "test_principal"
    b_id_farm = await addFarm(fdm, principal_id, "Zone Farm", "123456", "Weg 1", "1234AB")
    l_id_herd = await addHerd(fdm, principal_id, b_id_farm, {
      l_herd_name: "Melkkoeien",
      l_id_category: "rvo_100",
    })
    b_id = await addField(
      fdm,
      principal_id,
      b_id_farm,
      "Huiskavel",
      "zone_src",
      strip(5.0, 5.01),
      new Date("2025-01-01"),
      "nl_01",
    )

    // The whole-field grazed area equals the field area
    await addGrazing(fdm, principal_id, l_id_herd, day(1), { b_id, l_grazing_end: day(2) })
    const [whole] = await getGrazingForField(fdm, principal_id, b_id)
    fieldArea = whole.l_grazing_area_grazed as number
    await removeGrazing(fdm, principal_id, whole.l_id_grazing)
  })

  it("stores a Polygon zone as MultiPolygon and clips its area to the field", async () => {
    expect(fieldArea).toBeGreaterThan(50)

    // Half of this zone lies west of the field
    await addGrazing(fdm, principal_id, l_id_herd, day(3), {
      b_id,
      l_grazing_end: day(4),
      l_grazing_geometry_zone: strip(4.995, 5.005),
    })

    const [grazing] = await getGrazingForField(fdm, principal_id, b_id)
    expect(grazing.l_grazing_geometry_zone?.type).toBe("MultiPolygon")
    expect(grazing.l_grazing_area).toBeNull()
    expect(grazing.l_grazing_area_grazed).toBeCloseTo(fieldArea / 2, 0)
  })

  it("caps an area without a location at the field area", async () => {
    await addGrazing(fdm, principal_id, l_id_herd, day(3), {
      b_id,
      l_grazing_end: day(4),
      l_grazing_area: 5,
    })
    await addGrazing(fdm, principal_id, l_id_herd, day(5), {
      b_id,
      l_grazing_end: day(6),
      l_grazing_area: 10000,
    })

    const grazings = await getGrazingForField(fdm, principal_id, b_id)
    expect(grazings.map((g) => g.l_grazing_area_grazed)).toEqual([fieldArea, 5])
  })

  it("rejects a zone together with an area, a zone without a field and an invalid zone", async () => {
    await expect(
      addGrazing(fdm, principal_id, l_id_herd, day(3), {
        b_id,
        l_grazing_area: 5,
        l_grazing_geometry_zone: strip(5.0, 5.005),
      }),
    ).rejects.toThrowError("Exception for addGrazing")

    await expect(
      addGrazing(fdm, principal_id, l_id_herd, day(3), {
        l_grazing_geometry_zone: strip(5.0, 5.005),
      }),
    ).rejects.toThrowError("Exception for addGrazing")

    await expect(
      addGrazings(fdm, principal_id, [
        {
          l_id_herd,
          b_id,
          l_grazing_start: day(3),
          l_grazing_geometry_zone: { type: "Polygon", coordinates: [[[5, 52]]] },
        },
      ]),
    ).rejects.toThrowError("Exception for addGrazings")
  })

  it("switches a grazing between an area and a zone", async () => {
    await addGrazing(fdm, principal_id, l_id_herd, day(3), {
      b_id,
      l_grazing_end: day(4),
      l_grazing_area: 5,
    })
    const [grazing] = await getGrazingForField(fdm, principal_id, b_id)

    // The area must be cleared when a zone is set
    await expect(
      updateGrazing(fdm, principal_id, grazing.l_id_grazing, {
        l_grazing_geometry_zone: strip(5.0, 5.005),
      }),
    ).rejects.toThrowError("Exception for updateGrazing")

    await updateGrazing(fdm, principal_id, grazing.l_id_grazing, {
      l_grazing_area: null,
      l_grazing_geometry_zone: strip(5.0, 5.005),
    })
    const zoned = await getGrazing(fdm, principal_id, grazing.l_id_grazing)
    expect(zoned.l_grazing_area).toBeNull()
    expect(zoned.l_grazing_area_grazed).toBeCloseTo(fieldArea / 2, 0)

    await updateGrazing(fdm, principal_id, grazing.l_id_grazing, { l_grazing_geometry_zone: null })
    const whole = await getGrazing(fdm, principal_id, grazing.l_id_grazing)
    expect(whole.l_grazing_geometry_zone).toBeNull()
    expect(whole.l_grazing_area_grazed).toBe(fieldArea)
  })

  it("lists earlier zones once, most recently used first", async () => {
    await addGrazings(fdm, principal_id, [
      {
        l_id_herd,
        b_id,
        l_grazing_start: day(3),
        l_grazing_end: day(4),
        l_grazing_geometry_zone: strip(5.0, 5.005),
      },
      {
        l_id_herd,
        b_id,
        l_grazing_start: day(5),
        l_grazing_end: day(6),
        l_grazing_geometry_zone: strip(5.005, 5.01),
      },
      {
        l_id_herd,
        b_id,
        l_grazing_start: day(7),
        l_grazing_end: day(8),
        l_grazing_geometry_zone: strip(5.0, 5.005),
      },
      { l_id_herd, b_id, l_grazing_start: day(9), l_grazing_end: day(10) },
    ])

    const zones = await getGrazingZonesForField(fdm, principal_id, b_id)
    expect(zones.length).toBe(2)
    expect(zones[0].usage_count).toBe(2)
    expect(zones[0].last_used).toEqual(day(7))
    expect(zones[0].l_herd_names).toEqual(["Melkkoeien"])
    expect(zones[0].l_grazing_geometry_zone.type).toBe("MultiPolygon")
    expect(zones[0].l_grazing_area_grazed).toBeCloseTo(fieldArea / 2, 0)
    expect(zones[1].usage_count).toBe(1)
  })

  it("lists the zones used in a period, without the excluded record", async () => {
    await addGrazings(fdm, principal_id, [
      {
        l_id_herd,
        b_id,
        l_grazing_start: day(3),
        l_grazing_end: day(4),
        l_grazing_geometry_zone: strip(5.0, 5.005),
      },
      {
        l_id_herd,
        b_id,
        l_grazing_start: day(20),
        l_grazing_end: day(21),
        l_grazing_geometry_zone: strip(5.0, 5.005),
      },
    ])
    const [later, earlier] = await getGrazingForField(fdm, principal_id, b_id)
    expect(earlier.l_grazing_start).toEqual(day(3))

    // Without a period the zone's last use is the later grazing
    const [all] = await getGrazingZonesForField(fdm, principal_id, b_id)
    expect(all.last_used).toEqual(day(20))

    // In a period around the earlier grazing, that use counts
    const inPeriod = await getGrazingZonesForField(fdm, principal_id, b_id, 20, {
      from: day(1),
      to: day(10),
    })
    expect(inPeriod).toHaveLength(1)
    expect(inPeriod[0].last_used).toEqual(day(3))
    expect(inPeriod[0].usage_count).toBe(1)

    // Excluding one record keeps the other use of the same zone
    const withoutLater = await getGrazingZonesForField(fdm, principal_id, b_id, 20, {
      exclude_l_id_grazing: later.l_id_grazing,
    })
    expect(withoutLater).toHaveLength(1)
    expect(withoutLater[0].last_used).toEqual(day(3))
    expect(
      await getGrazingZonesForField(fdm, principal_id, b_id, 20, {
        from: day(1),
        to: day(10),
        exclude_l_id_grazing: earlier.l_id_grazing,
      }),
    ).toEqual([])
  })

  it("adds up successive strips in the grazed area of a field", async () => {
    await addGrazings(fdm, principal_id, [
      {
        l_id_herd,
        b_id,
        l_grazing_start: day(3),
        l_grazing_end: day(4),
        l_grazing_geometry_zone: strip(5.0, 5.0025),
      },
      {
        l_id_herd,
        b_id,
        l_grazing_start: day(5),
        l_grazing_end: day(6),
        l_grazing_geometry_zone: strip(5.0025, 5.005),
      },
    ])
    const timeframe = { start: day(1), end: day(30) }

    const [strips] = await getGrazedAreaForFarm(fdm, principal_id, b_id_farm, timeframe)
    expect(strips.b_id).toBe(b_id)
    expect(strips.b_area).toBe(fieldArea)
    expect(strips.b_area_grazed).toBeCloseTo(fieldArea / 2, 0)

    // An area without a location only counts when it is larger than the zones
    await addGrazing(fdm, principal_id, l_id_herd, day(7), {
      b_id,
      l_grazing_end: day(8),
      l_grazing_area: fieldArea * 0.75,
    })
    const [withArea] = await getGrazedAreaForFarm(fdm, principal_id, b_id_farm, timeframe)
    expect(withArea.b_area_grazed).toBeCloseTo(fieldArea * 0.75, 1)

    // A grazing of the whole field makes the whole field grazed
    await addGrazing(fdm, principal_id, l_id_herd, day(9), { b_id, l_grazing_end: day(10) })
    const [whole] = await getGrazedAreaForFarm(fdm, principal_id, b_id_farm, timeframe)
    expect(whole.b_area_grazed).toBe(fieldArea)
  })

  it("books a herd on the same field only once a day", async () => {
    // A grazing of one day, on a strip of the field
    await addGrazing(fdm, principal_id, l_id_herd, day(10), {
      b_id,
      l_grazing_end: day(10),
      l_grazing_geometry_zone: strip(5.0, 5.0025),
    })

    // A second grazing on that day is rejected, also of one day on another strip
    await expect(
      addGrazing(fdm, principal_id, l_id_herd, day(10), {
        b_id,
        l_grazing_end: day(10),
        l_grazing_geometry_zone: strip(5.0025, 5.005),
      }),
    ).rejects.toThrowError("Exception for addGrazing")
    // A grazing that ends on that day is rejected too
    await expect(
      addGrazing(fdm, principal_id, l_id_herd, day(8), { b_id, l_grazing_end: day(10) }),
    ).rejects.toThrowError("Exception for addGrazing")

    // The next day is free
    await addGrazing(fdm, principal_id, l_id_herd, day(11), {
      b_id,
      l_grazing_end: day(12),
      l_grazing_geometry_zone: strip(5.0025, 5.005),
    })

    // A grazing that starts on the end day of the previous one is rejected
    await expect(
      addGrazing(fdm, principal_id, l_id_herd, day(12), { b_id, l_grazing_end: day(13) }),
    ).rejects.toThrowError("Exception for addGrazing")

    // Moving a grazing onto a booked day is rejected
    const [next] = (await getGrazingForField(fdm, principal_id, b_id)).filter(
      (g) => g.l_grazing_start.getTime() === day(11).getTime(),
    )
    await expect(
      updateGrazing(fdm, principal_id, next.l_id_grazing, { l_grazing_start: day(10) }),
    ).rejects.toThrowError("Exception for updateGrazing")

    // Two grazings on one day in a batch are rejected
    await expect(
      addGrazings(fdm, principal_id, [
        { l_id_herd, b_id, l_grazing_start: day(20), l_grazing_end: day(20) },
        { l_id_herd, b_id, l_grazing_start: day(20), l_grazing_end: day(20) },
      ]),
    ).rejects.toThrowError("Exception for addGrazings")
  })
})
