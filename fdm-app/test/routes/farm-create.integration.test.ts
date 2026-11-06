/**
 * Creating a farm (`farm.create._index`), redirect-only routes, and the field settings loader
 * (`farm.$b_id_farm.$calendar.field.$b_id.settings`).
 */
import { getFarms, getFertilizers } from "@nmi-agro/fdm-core"
import { beforeAll, describe, expect, it } from "vitest"
import { fdm } from "~/lib/fdm.server"
import { loader as indexLoader } from "~/routes/_index"
import { loader as atlasIndexLoader } from "~/routes/farm.$b_id_farm.$calendar.atlas._index"
import { loader as fieldSettingsLoader } from "~/routes/farm.$b_id_farm.$calendar.field.$b_id.settings"
import { action as createFarmAction } from "~/routes/farm.create._index"
import { actionArgs, loaderArgs, runRoute, type SeededUser, seedUserWithFarm } from "../helpers"
import { signInAs } from "../session"

let owner: SeededUser
let stranger: SeededUser

beforeAll(async () => {
  owner = await seedUserWithFarm("creator")
  stranger = await seedUserWithFarm("other")
})

describe("redirect-only routes", () => {
  it("sends / to the sign-in page", async () => {
    const { status, location } = await runRoute(() => indexLoader())
    expect(status).toBe(302)
    expect(location).toBe("./signin")
  })

  it("sends the atlas index to the fields map", async () => {
    const { status, location } = await runRoute(() => atlasIndexLoader())
    expect(status).toBe(302)
    expect(location).toBe("./fields")
  })
})

describe("create a farm", () => {
  it("creates the farm with its catalogues and redirects to the next step", async () => {
    signInAs(owner.user)
    const year = String(owner.ids.year)
    const { status, location } = await runRoute(() =>
      createFarmAction(
        actionArgs(
          "/farm/create",
          {},
          { b_name_farm: "Nieuw testbedrijf", year, b_postalcode_farm: "6700 AA" },
        ),
      ),
    )
    expect(status).toBe(302)

    const created = (await getFarms(fdm, owner.user.id)).find(
      (farm) => farm.b_name_farm === "Nieuw testbedrijf",
    )
    expect(created).toBeDefined()
    expect(location).toBe(`./${created?.b_id_farm}/${year}`)
    // Every fertilizer of the enabled catalogues is added to the new farm.
    const fertilizers = await getFertilizers(fdm, owner.user.id, created?.b_id_farm ?? "")
    expect(fertilizers.length).toBeGreaterThan(0)
  })

  it("does not create a farm without a valid name", async () => {
    signInAs(owner.user)
    const before = (await getFarms(fdm, owner.user.id)).length
    const { status } = await runRoute(() =>
      createFarmAction(actionArgs("/farm/create", {}, { b_name_farm: "", year: "2025" })),
    )
    expect(status).toBeGreaterThanOrEqual(400)
    expect((await getFarms(fdm, owner.user.id)).length).toBe(before)
  })
})

describe("field settings loader", () => {
  const params = (user: SeededUser, b_id: string) => ({
    b_id_farm: user.ids.farm,
    calendar: String(user.ids.year),
    b_id,
  })
  const path = (p: ReturnType<typeof params>) =>
    `/farm/${p.b_id_farm}/${p.calendar}/field/${p.b_id}/settings`

  it("returns the field of the signed-in owner", async () => {
    signInAs(owner.user)
    const b_id = owner.ids.fields.tarwe ?? ""
    const p = params(owner, b_id)
    const { status, data } = await runRoute(() => fieldSettingsLoader(loaderArgs(path(p), p)))
    expect(status).toBe(200)
    expect(data).toMatchObject({ field: { b_id, b_name: "Lange akker" } })
  })

  it("does not show another user's field", async () => {
    signInAs(stranger.user)
    const p = params(owner, owner.ids.fields.tarwe ?? "")
    const { status } = await runRoute(() => fieldSettingsLoader(loaderArgs(path(p), p)))
    expect([403, 404]).toContain(status)
  })
})
