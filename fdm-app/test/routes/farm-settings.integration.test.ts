/**
 * Loader and action of the farm properties page (`farm.$b_id_farm.settings.properties`):
 * data shape, access by another user, validation and saving.
 */
import { getFarm } from "@nmi-agro/fdm-core"
import { beforeAll, describe, expect, it } from "vitest"
import { fdm } from "~/lib/fdm.server"
import { action, loader } from "~/routes/farm.$b_id_farm.settings.properties"
import { actionArgs, loaderArgs, runRoute, type SeededUser, seedUserWithFarm } from "../helpers"
import { signInAs } from "../session"

let owner: SeededUser
let stranger: SeededUser

beforeAll(async () => {
  owner = await seedUserWithFarm("owner")
  stranger = await seedUserWithFarm("stranger")
})

const path = (b_id_farm: string) => `/farm/${b_id_farm}/settings/properties`

describe("loader", () => {
  it("returns the farm and the owner's write permission", async () => {
    signInAs(owner.user)
    const { status, data } = await runRoute(() =>
      loader(loaderArgs(path(owner.ids.farm), { b_id_farm: owner.ids.farm })),
    )
    expect(status).toBe(200)
    expect(data).toMatchObject({
      farm: { b_id_farm: owner.ids.farm, b_name_farm: expect.any(String) },
      farmWritePermission: true,
      isKvkConfigured: false,
    })
  })

  it("refuses another user's farm", async () => {
    signInAs(stranger.user)
    const { status } = await runRoute(() =>
      loader(loaderArgs(path(owner.ids.farm), { b_id_farm: owner.ids.farm })),
    )
    expect(status).toBe(403)
  })

  it("sends a signed-out visitor to the sign-in page", async () => {
    signInAs(null)
    const { status, location } = await runRoute(() =>
      loader(loaderArgs(path(owner.ids.farm), { b_id_farm: owner.ids.farm })),
    )
    expect(status).toBe(302)
    expect(location).toBe("/signin")
  })
})

describe("action", () => {
  it("saves valid properties", async () => {
    signInAs(owner.user)
    const { status } = await runRoute(() =>
      action(
        actionArgs(
          path(owner.ids.farm),
          { b_id_farm: owner.ids.farm },
          { b_name_farm: "Testbedrijf De Akker", b_postalcode_farm: "6700 AA" },
        ),
      ),
    )
    expect(status).toBe(200)
    const farm = await getFarm(fdm, owner.user.id, owner.ids.farm)
    expect(farm).toMatchObject({
      b_name_farm: "Testbedrijf De Akker",
      b_postalcode_farm: "6700 AA",
    })
  })

  it("rejects invalid properties and leaves the farm unchanged", async () => {
    signInAs(owner.user)
    const before = await getFarm(fdm, owner.user.id, owner.ids.farm)
    const { status, data } = await runRoute(() =>
      action(
        actionArgs(
          path(owner.ids.farm),
          { b_id_farm: owner.ids.farm },
          { b_name_farm: "X", b_businessid_farm: "123" },
        ),
      ),
    )
    // Validation errors currently surface as a generic error (500) with an error code, rather
    // than as a 400 with the field issues; this test only pins that nothing is saved.
    expect(status).toBeGreaterThanOrEqual(400)
    expect(data).toMatchObject({ warning: expect.any(String) })
    expect(await getFarm(fdm, owner.user.id, owner.ids.farm)).toEqual(before)
  })

  it("refuses to change another user's farm", async () => {
    signInAs(stranger.user)
    const { status } = await runRoute(() =>
      action(
        actionArgs(
          path(owner.ids.farm),
          { b_id_farm: owner.ids.farm },
          { b_name_farm: "Overgenomen bedrijf" },
        ),
      ),
    )
    expect(status).toBe(403)
    const farm = await getFarm(fdm, owner.user.id, owner.ids.farm)
    expect(farm.b_name_farm).not.toBe("Overgenomen bedrijf")
  })
})
