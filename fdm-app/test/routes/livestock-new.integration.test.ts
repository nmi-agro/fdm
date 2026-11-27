/**
 * Loader and action of the "Melkvee toevoegen" page (`farm.$b_id_farm.$calendar.livestock.new`):
 * the default arrival day and the arrival of the new animals.
 */
import { getAnimalsForHerd, getHerdsForFarm } from "@nmi-agro/fdm-core"
import { beforeAll, describe, expect, it } from "vitest"
import { fdm } from "~/lib/fdm.server"
import { action, loader } from "~/routes/farm.$b_id_farm.$calendar.livestock.new"
import { actionArgs, loaderArgs, runRoute, type SeededUser, seedUserWithFarm } from "../helpers"
import { signInAs } from "../session"

let owner: SeededUser

beforeAll(async () => {
  owner = await seedUserWithFarm("herd")
})

const path = (b_id_farm: string) => `/farm/${b_id_farm}/2025/livestock/new`
const params = () => ({ b_id_farm: owner.ids.farm, calendar: "2025" })

describe("loader", () => {
  it("lets the animals arrive on 1 January of the chosen year by default", async () => {
    signInAs(owner.user)
    const { status, data } = await runRoute(() =>
      loader(loaderArgs(path(owner.ids.farm), params())),
    )
    expect(status).toBe(200)
    expect(data).toMatchObject({ defaultArrivalDay: "2025-01-01" })
  })
})

describe("action", () => {
  it("creates the herd with animals that arrived on the chosen day", async () => {
    signInAs(owner.user)
    const { status } = await runRoute(() =>
      action(
        actionArgs(path(owner.ids.farm), params(), {
          l_id_category: "rvo_100",
          l_herd_name: "Koppel sinds januari",
          count: "3",
          l_arriving_date: "2025-01-01",
        }),
      ),
    )
    expect(status).toBe(302)

    const herds = await getHerdsForFarm(fdm, owner.user.id, owner.ids.farm)
    const herd = herds.find((h) => h.l_herd_name === "Koppel sinds januari")
    if (!herd) throw new Error("The new herd is missing")
    const animals = await getAnimalsForHerd(fdm, owner.user.id, herd.l_id_herd)
    expect(animals).toHaveLength(3)
    for (const animal of animals) {
      expect(animal.l_arriving_date).toEqual(new Date("2025-01-01T00:00:00.000Z"))
    }
  })

  it("refuses a category of a species that does not graze", async () => {
    signInAs(owner.user)
    const { status } = await runRoute(() =>
      action(
        actionArgs(path(owner.ids.farm), params(), {
          l_id_category: "rvo_400",
          l_herd_name: "Koppel varkens",
          count: "1",
        }),
      ),
    )
    expect(status).toBe(400)
    const herds = await getHerdsForFarm(fdm, owner.user.id, owner.ids.farm)
    expect(herds.some((h) => h.l_herd_name === "Koppel varkens")).toBe(false)
  })

  it("refuses an arrival day in the future", async () => {
    signInAs(owner.user)
    const { status } = await runRoute(() =>
      action(
        actionArgs(path(owner.ids.farm), params(), {
          l_id_category: "rvo_100",
          l_herd_name: "Koppel uit de toekomst",
          count: "1",
          l_arriving_date: "2999-01-01",
        }),
      ),
    )
    expect(status).toBe(400)
    const herds = await getHerdsForFarm(fdm, owner.user.id, owner.ids.farm)
    expect(herds.some((h) => h.l_herd_name === "Koppel uit de toekomst")).toBe(false)
  })
})
