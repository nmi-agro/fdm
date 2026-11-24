import { getAnimalCategoriesCatalogue } from "@nmi-agro/fdm-data"
import { beforeEach, describe, expect, inject, it } from "vitest"
import type { FdmType } from "./fdm.types"
import { addAnimal, updateAnimal } from "./animal"
import {
  disableAnimalCategoryCatalogue,
  enableAnimalCategoryCatalogue,
  syncAnimalCategoryCatalogueArray,
} from "./catalogues"
import { addFarm } from "./farm"
import { createFdmServer } from "./fdm-server"
import {
  addHerd,
  getHerd,
  getHerdsForFarm,
  getHerdsForFarmInPeriod,
  removeHerd,
  updateHerd,
} from "./herd"

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
    await enableAnimalCategoryCatalogue(fdm, principal_id, b_id_farm, "rvo")
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

  it("should refuse a herd end before its start", async () => {
    const refused = {
      cause: { message: expect.stringContaining("end cannot be earlier than start") },
    }
    await expect(
      addHerd(fdm, principal_id, b_id_farm, {
        l_id_category: "rvo_100",
        l_start: new Date("2025-06-01"),
        l_end: new Date("2025-05-01"),
      }),
    ).rejects.toMatchObject(refused)

    const herd = await addHerd(fdm, principal_id, b_id_farm, {
      l_id_category: "rvo_100",
      l_start: new Date("2025-06-01"),
    })
    await expect(
      updateHerd(fdm, principal_id, herd, { l_end: new Date("2025-05-01") }),
    ).rejects.toMatchObject(refused)
    // Without a known start any end is allowed
    await addHerd(fdm, principal_id, b_id_farm, {
      l_id_category: "rvo_100",
      l_end: new Date("2020-01-01"),
    })
  })

  it("should reject removing a herd that still has an animal assigned", async () => {
    const l_id_herd = await addHerd(fdm, principal_id, b_id_farm, {
      l_herd_name: "Melkkoeien",
      l_id_category: "rvo_100",
    })

    await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
      l_id_eartag: "NL900000001",
    })

    await expect(removeHerd(fdm, principal_id, l_id_herd)).rejects.toMatchObject({
      cause: { message: expect.stringContaining("an animal is assigned to it") },
    })
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
      addHerd(fdm, invalidUser, b_id_farm, {
        l_herd_name: "Should Fail",
        l_id_category: "rvo_101",
      }),
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
    ).rejects.toMatchObject({
      cause: { message: expect.stringContaining("missing_category is not enabled") },
    })

    const l_id_herd = await addHerd(fdm, principal_id, b_id_farm, {
      l_herd_name: "Known category",
      l_id_category: "rvo_100",
    })

    await expect(
      updateHerd(fdm, principal_id, l_id_herd, { l_id_category: "missing_category" }),
    ).rejects.toMatchObject({
      cause: { message: expect.stringContaining("missing_category is not enabled") },
    })
  })

  it("should only change the category of a herd that never had animals", async () => {
    const l_id_herd = await addHerd(fdm, principal_id, b_id_farm, {
      l_herd_name: "Nieuwe koppel",
      l_id_category: "rvo_100",
    })

    // Without animals the category can still change
    await updateHerd(fdm, principal_id, l_id_herd, { l_id_category: "rvo_101" })
    expect((await getHerd(fdm, principal_id, l_id_herd)).l_id_category).toBe("rvo_101")

    // Once an animal has been in it, even one that has left, the category is fixed
    const l_id_animal = await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
      l_arriving_date: new Date("2025-01-01"),
    })
    await updateAnimal(fdm, principal_id, l_id_animal, {
      l_leaving_date: new Date("2025-02-01"),
      l_leaving_method: "sold",
    })
    await expect(
      updateHerd(fdm, principal_id, l_id_herd, { l_id_category: "rvo_102" }),
    ).rejects.toMatchObject({
      cause: { message: expect.stringContaining("has or had animals") },
    })
    // Passing the same category is fine
    await updateHerd(fdm, principal_id, l_id_herd, { l_id_category: "rvo_101" })
  })

  it("should rename a herd after the farm turned its category's catalogue off", async () => {
    const l_id_herd = await addHerd(fdm, principal_id, b_id_farm, {
      l_herd_name: "Melkkoeien",
      l_id_category: "rvo_100",
    })
    await disableAnimalCategoryCatalogue(fdm, principal_id, b_id_farm, "rvo")

    // The form sends the unchanged category along with the new name
    await updateHerd(fdm, principal_id, l_id_herd, {
      l_herd_name: "Melkkoeien oost",
      l_id_category: "rvo_100",
    })
    expect((await getHerd(fdm, principal_id, l_id_herd)).l_herd_name).toBe("Melkkoeien oost")
  })

  it("should only end a herd that has no animals on its end date", async () => {
    const l_id_herd = await addHerd(fdm, principal_id, b_id_farm, {
      l_herd_name: "Melkkoeien",
      l_id_category: "rvo_100",
    })
    const l_id_animal = await addAnimal(fdm, principal_id, b_id_farm, l_id_herd, {
      l_arriving_date: new Date("2025-01-01"),
    })

    await expect(
      updateHerd(fdm, principal_id, l_id_herd, { l_end: new Date("2025-06-01") }),
    ).rejects.toMatchObject({
      cause: { message: expect.stringContaining("still has animals on its end date") },
    })

    // Once the animal has left before that date, the herd can end
    await updateAnimal(fdm, principal_id, l_id_animal, {
      l_leaving_date: new Date("2025-05-01"),
      l_leaving_method: "sold",
    })
    await updateHerd(fdm, principal_id, l_id_herd, { l_end: new Date("2025-06-01") })
    expect((await getHerd(fdm, principal_id, l_id_herd)).l_end).toEqual(new Date("2025-06-01"))
  })

  it("should list the herds that run at some moment within a period", async () => {
    const endedBefore = await addHerd(fdm, principal_id, b_id_farm, {
      l_herd_name: "Ended before",
      l_id_category: "rvo_100",
      l_end: new Date("2024-12-01"),
    })
    const endedDuring = await addHerd(fdm, principal_id, b_id_farm, {
      l_herd_name: "Ended during",
      l_id_category: "rvo_100",
      l_end: new Date("2025-06-01"),
    })
    const startsDuring = await addHerd(fdm, principal_id, b_id_farm, {
      l_herd_name: "Starts during",
      l_id_category: "rvo_100",
      l_start: new Date("2025-09-01"),
    })
    const startsAfter = await addHerd(fdm, principal_id, b_id_farm, {
      l_herd_name: "Starts after",
      l_id_category: "rvo_100",
      l_start: new Date("2026-02-01"),
    })

    const herds = await getHerdsForFarmInPeriod(fdm, principal_id, b_id_farm, {
      start: new Date("2025-01-01"),
      end: new Date("2025-12-31"),
    })
    const ids = herds.map((herd) => herd.l_id_herd)
    expect(ids).toContain(endedDuring)
    expect(ids).toContain(startsDuring)
    expect(ids).not.toContain(endedBefore)
    expect(ids).not.toContain(startsAfter)
    expect(herds.find((herd) => herd.l_id_herd === endedDuring)).toMatchObject({
      l_herd_name: "Ended during",
      l_category: "100 - Melk- en kalfkoeien",
      b_id_farm,
    })

    await expect(
      getHerdsForFarmInPeriod(fdm, "unauthorized_user", b_id_farm, {
        start: new Date("2025-01-01"),
        end: new Date("2025-12-31"),
      }),
    ).rejects.toThrowError("Principal does not have permission to perform this action")
  })
})
