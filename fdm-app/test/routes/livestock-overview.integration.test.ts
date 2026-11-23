/**
 * Action of the Melkvee overview (`farm.$b_id_farm.$calendar.livestock._index`): adding animals
 * to a herd with the plus on its card, on a chosen arrival day.
 */
import { createHerdWithAnimals, getAnimalsForHerd } from "@nmi-agro/fdm-core"
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
