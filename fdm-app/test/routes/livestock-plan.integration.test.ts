/**
 * Action of the Beweidingsplanner (`farm.$b_id_farm.$calendar.livestock.grazing.plan`): only
 * periods on real days within the year of the page are saved.
 */
import { createHerdWithAnimals, getGrazingForHerd } from "@nmi-agro/fdm-core"
import { beforeAll, describe, expect, it } from "vitest"
import { fdm } from "~/lib/fdm.server"
import { action } from "~/routes/farm.$b_id_farm.$calendar.livestock.grazing.plan"
import { actionArgs, runRoute, type SeededUser, seedUserWithFarm } from "../helpers"
import { signInAs } from "../session"

let owner: SeededUser
let l_id_herd: string
let b_id: string

beforeAll(async () => {
  owner = await seedUserWithFarm("plan")
  ;({ l_id_herd } = await createHerdWithAnimals(
    fdm,
    owner.user.id,
    owner.ids.farm,
    { l_herd_name: "Melkkoeien", l_id_category: "rvo_100" },
    10,
    { l_arriving_date: new Date("2025-01-01") },
  ))
  const field = Object.values(owner.ids.fields)[0]
  if (!field) throw new Error("The seeded farm has no field")
  b_id = field
})

const savePlan = (rows: Array<{ l_grazing_start: string; l_grazing_end: string }>) =>
  runRoute(() =>
    action(
      actionArgs(
        `/farm/${owner.ids.farm}/2025/livestock/grazing/plan`,
        { b_id_farm: owner.ids.farm, calendar: "2025" },
        {
          plan_rows: JSON.stringify(
            rows.map((r) => ({ ...r, l_id_herd, b_id, l_grazing_hours: 8 })),
          ),
        },
      ),
    ),
  )

describe("action", () => {
  it("refuses a period outside the year of the page", async () => {
    signInAs(owner.user)
    const { status } = await savePlan([
      { l_grazing_start: "2026-06-01", l_grazing_end: "2026-06-01" },
    ])
    expect(status).toBe(400)
    expect(await getGrazingForHerd(fdm, owner.user.id, l_id_herd)).toHaveLength(0)
  })

  it("saves a period within the year of the page", async () => {
    signInAs(owner.user)
    const { status } = await savePlan([
      { l_grazing_start: "2025-06-01", l_grazing_end: "2025-06-02" },
    ])
    expect(status).toBe(302)
    expect(await getGrazingForHerd(fdm, owner.user.id, l_id_herd)).toHaveLength(1)
  })

  it("refuses a day that does not exist", async () => {
    signInAs(owner.user)
    const { status } = await savePlan([
      { l_grazing_start: "2025-02-30", l_grazing_end: "2025-02-30" },
    ])
    expect(status).toBe(400)
  })
})
