/**
 * Action of the Beweidingskalender (`farm.$b_id_farm.$calendar.livestock.grazing._index`): the
 * mowing and fertilizing forms send their values JSON-encoded, as remix-hook-form does by default,
 * and still reach the field-event handling.
 */
import { getFertilizerApplications } from "@nmi-agro/fdm-core"
import { beforeAll, describe, expect, it } from "vitest"
import { fdm } from "~/lib/fdm.server"
import { action } from "~/routes/farm.$b_id_farm.$calendar.livestock.grazing._index"
import { actionArgs, runRoute, type SeededUser, seedUserWithFarm } from "../helpers"
import { signInAs } from "../session"

let owner: SeededUser

beforeAll(async () => {
  owner = await seedUserWithFarm("calendar")
})

describe("action", () => {
  it("handles a JSON-encoded fertilizer intent as a field event", async () => {
    signInAs(owner.user)
    const [fieldKey, records] = Object.entries(owner.ids.records).find(
      ([, r]) => (r?.applications.length ?? 0) > 0,
    ) ?? [undefined, undefined]
    const b_id = fieldKey ? owner.ids.fields[fieldKey as keyof typeof owner.ids.fields] : undefined
    const p_app_id = records?.applications[0]
    if (!b_id || !p_app_id) throw new Error("The seeded farm has no fertilizer application")

    const { status } = await runRoute(() =>
      action(
        actionArgs(
          `/farm/${owner.ids.farm}/2025/livestock/grazing`,
          { b_id_farm: owner.ids.farm, calendar: "2025" },
          // Values as remix-hook-form sends them: strings with their quotes
          { intent: '"remove_fertilizer"', p_app_id: JSON.stringify(p_app_id) },
        ),
      ),
    )
    expect(status).toBe(200)

    const remaining = await getFertilizerApplications(fdm, owner.user.id, b_id)
    expect(remaining.map((a) => a.p_app_id)).not.toContain(p_app_id)
  })
})
