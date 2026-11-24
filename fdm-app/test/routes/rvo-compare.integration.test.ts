/**
 * The RVO comparison (`farm.$b_id_farm.$calendar.rvo`) reads the cultivations of the farm's
 * fields in the year once for the farm instead of per field. This test checks that the fields it
 * compares with the RVO data are the same as with the per-field reads.
 *
 * RVO itself is not reached: the RVO token, client and fields are replaced by stubs, and the
 * comparison records the local fields it receives. Only this file imports the RVO route, so the
 * mocks apply to it even when another test file in the same worker (`isolate: false`) loaded the
 * real modules first.
 */
import { getCultivations, getFarm, getFields, updateFarm } from "@nmi-agro/fdm-core"
import { beforeAll, describe, expect, it, vi } from "vitest"
import { fdm } from "~/lib/fdm.server"
import { loader } from "~/routes/farm.$b_id_farm.$calendar.rvo"
import { loaderArgs, runRoute, type SeededUser, seedUserWithFarm } from "../helpers"
import { signInAs } from "../session"

vi.mock("~/integrations/rvo.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/integrations/rvo.server")>()
  return {
    ...actual,
    parseRvoToken: async () => ({ accessToken: "test-token", mode: "own_farm" as const }),
    getRvoCredentials: () => ({
      clientId: "test",
      redirectUri: "http://localhost/callback/rvo",
      clientName: "test",
      pkioPrivateKey: "test",
      logXml: undefined,
    }),
    createConfiguredRvoClient: () => ({ setAccessToken: () => undefined }),
  }
})

const compareFields = vi.hoisted(() => vi.fn((..._args: unknown[]) => [] as unknown[]))

vi.mock("~/lib/rvo.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/lib/rvo.server")>()
  return { ...actual, fetchRvoFields: async () => [], compareFields }
})

let owner: SeededUser
let calendar: string

beforeAll(async () => {
  owner = await seedUserWithFarm("rvo")
  calendar = String(owner.ids.year)
  // The comparison needs the KvK number of the farm (a made-up one)
  const farm = await getFarm(fdm, owner.user.id, owner.ids.farm)
  await updateFarm(
    fdm,
    owner.user.id,
    owner.ids.farm,
    farm.b_name_farm,
    "99999999",
    farm.b_address_farm,
    farm.b_postalcode_farm,
  )
})

describe("RVO comparison", () => {
  it("compares the fields with the cultivations of the per-field reads", async () => {
    signInAs(owner.user)
    compareFields.mockClear()
    const path = `/farm/${owner.ids.farm}/${calendar}/rvo`
    const { status, data } = await runRoute(() =>
      loader(
        loaderArgs(path, { b_id_farm: owner.ids.farm, calendar }) as Parameters<typeof loader>[0],
      ),
    )
    expect(status).toBe(200)
    expect((data as { error: string | null }).error).toBeNull()
    expect(compareFields).toHaveBeenCalledTimes(1)

    const timeframe = {
      start: new Date(`${calendar}-01-01`),
      end: new Date(`${calendar}-12-31`),
    }
    const fields = await getFields(fdm, owner.user.id, owner.ids.farm)
    const expected = await Promise.all(
      fields.map(async (field) => ({
        ...field,
        cultivations: await getCultivations(fdm, owner.user.id, field.b_id, timeframe),
      })),
    )
    const [localFields, , year] = compareFields.mock.calls[0]
    expect(year).toBe(owner.ids.year)
    expect(expected.some((field) => field.cultivations.length > 0)).toBe(true)
    expect(localFields).toEqual(expected)
  })
})
