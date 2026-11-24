/**
 * Action of the Melkvee overview (`farm.$b_id_farm.$calendar.livestock._index`): adding animals
 * to a herd with the plus on its card, on a chosen arrival day.
 */
import {
  addFarm,
  createHerdWithAnimals,
  getAnimalsForHerd,
  getGrazingForHerd,
} from "@nmi-agro/fdm-core"
import { beforeAll, describe, expect, it } from "vitest"
import { fdm } from "~/lib/fdm.server"
import { action } from "~/routes/farm.$b_id_farm.$calendar.livestock._index"
import { actionArgs, runRoute, type SeededUser, seedUserWithFarm } from "../helpers"
import { signInAs } from "../session"

let owner: SeededUser
let l_id_herd: string

beforeAll(async () => {
  owner = await seedUserWithFarm("plus")
  ;({ l_id_herd } = await createHerdWithAnimals(
    fdm,
    owner.user.id,
    owner.ids.farm,
    { l_herd_name: "Melkkoeien", l_id_category: "rvo_100" },
    2,
    { l_arriving_date: new Date("2025-01-01") },
  ))
})

const path = (b_id_farm: string) => `/farm/${b_id_farm}/2025/livestock`
const params = () => ({ b_id_farm: owner.ids.farm, calendar: "2025" })

describe("action update_count", () => {
  it("adds animals that arrived on the chosen day", async () => {
    signInAs(owner.user)
    const { status } = await runRoute(() =>
      action(
        actionArgs(path(owner.ids.farm), params(), {
          intent: "update_count",
          l_id_herd,
          target_count: "3",
          previous_count: "2",
          l_arriving_date: "2025-03-01",
        }),
      ),
    )
    expect(status).toBe(200)

    const animals = await getAnimalsForHerd(fdm, owner.user.id, l_id_herd)
    expect(animals).toHaveLength(3)
    const arrivals = animals
      .map((a) => a.l_arriving_date?.toISOString() ?? "")
      .sort((a, b) => a.localeCompare(b))
    expect(arrivals).toEqual([
      "2025-01-01T00:00:00.000Z",
      "2025-01-01T00:00:00.000Z",
      "2025-03-01T00:00:00.000Z",
    ])
  })

  it("refuses more than 5000 animals at once", async () => {
    signInAs(owner.user)
    const { status } = await runRoute(() =>
      action(
        actionArgs(path(owner.ids.farm), params(), {
          intent: "update_count",
          l_id_herd,
          target_count: "6003",
          previous_count: "3",
        }),
      ),
    )
    expect(status).toBe(400)
    expect(await getAnimalsForHerd(fdm, owner.user.id, l_id_herd)).toHaveLength(3)
  })

  it("refuses an arrival day in the future", async () => {
    signInAs(owner.user)
    const { status } = await runRoute(() =>
      action(
        actionArgs(path(owner.ids.farm), params(), {
          intent: "update_count",
          l_id_herd,
          target_count: "4",
          previous_count: "3",
          l_arriving_date: "2999-01-01",
        }),
      ),
    )
    expect(status).toBe(400)
    expect(await getAnimalsForHerd(fdm, owner.user.id, l_id_herd)).toHaveLength(3)
  })
})

describe("action add_grazing", () => {
  it("refuses a herd of another farm of the same user", async () => {
    signInAs(owner.user)
    // The user also owns a second farm with its own herd
    const otherFarm = await addFarm(fdm, owner.user.id, "Tweede bedrijf", null, null, null)
    const { l_id_herd: otherHerd } = await createHerdWithAnimals(
      fdm,
      owner.user.id,
      otherFarm,
      { l_herd_name: "Andere koppel", l_id_category: "rvo_100" },
      1,
    )
    const b_id = Object.values(owner.ids.fields)[0]
    if (!b_id) throw new Error("The seeded farm has no field")

    const { status } = await runRoute(() =>
      action(
        actionArgs(path(owner.ids.farm), params(), {
          intent: "add_grazing",
          l_id_herd: otherHerd,
          b_id,
          l_grazing_start: "2025-05-01",
          l_grazing_end: "2025-05-01",
          l_grazing_hours: "8",
        }),
      ),
    )
    expect(status).toBe(404)
    expect(await getGrazingForHerd(fdm, owner.user.id, otherHerd)).toHaveLength(0)
  })
})
