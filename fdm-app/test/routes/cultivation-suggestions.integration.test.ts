/**
 * The fields table (`farm.$b_id_farm.$calendar.field`) only reads the database, so the sidebar
 * can prefetch it. Its cultivation suggestions, which come from the NMI API, load from the
 * resource route `farm.$b_id_farm.$calendar.cultivation-suggestions`.
 *
 * The NMI API is replaced by a fetch stub that answers the estimates of one location and counts
 * the requests. The field without a crop gets a new location on every run, so its estimate is
 * never cached yet. The API key is set in the server config with `withNmiApiKey`.
 */
import { addField, getFields } from "@nmi-agro/fdm-core"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { fdm } from "~/lib/fdm.server"
import { loader as suggestionsLoader } from "~/routes/farm.$b_id_farm.$calendar.cultivation-suggestions"
import { loader as fieldsTableLoader } from "~/routes/farm.$b_id_farm.$calendar.field"
import { loaderArgs, runRoute, type SeededUser, seedUserWithFarm, withNmiApiKey } from "../helpers"
import { signInAs } from "../session"

// The suggestions are only looked up when an NMI API key is configured
withNmiApiKey()

const NMI_ORIGIN = "https://api.nmi-agro.nl"
const realFetch = globalThis.fetch

/** The location (`lat,lon`) of the field without a crop, for which the stub knows grassland. */
let bareLocation = ""
/** The locations of the estimates requests since the last reset. */
const estimatesRequests: string[] = []

/** A small valid estimates answer with the BRP crop `b_lu_brp` in `year`. */
const estimatesBody = (year: number, b_lu_brp: number) => ({
  data: {
    ...Object.fromEntries(
      [
        "a_al_ox",
        "a_ca_co",
        "a_ca_co_po",
        "a_caco3_if",
        "a_cec_co",
        "a_clay_mi",
        "a_cn_fr",
        "a_com_fr",
        "a_cu_cc",
        "a_fe_ox",
        "a_k_cc",
        "a_k_co",
        "a_k_co_po",
        "a_mg_cc",
        "a_mg_co",
        "a_mg_co_po",
        "a_n_pmn",
        "a_n_rt",
        "a_p_al",
        "a_p_cc",
        "a_p_ox",
        "a_p_rt",
        "a_p_sg",
        "a_p_wa",
        "a_ph_cc",
        "a_s_rt",
        "a_sand_mi",
        "a_silt_mi",
        "a_som_loi",
        "a_zn_cc",
        "b_gwl_ghg",
        "b_gwl_glg",
        "b_c_st03",
        "b_som_potential",
        "b_c_st03_potential",
        "b_c_delta",
      ].map((key) => [key, 1]),
    ),
    b_soiltype_agr: "dekzand",
    b_gwl_class: "IIb",
    cultivations: [{ year, b_lu_brp }],
    cultivations_advanced: [],
  },
})

const fetchStub: typeof fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input))
  if (url.origin !== NMI_ORIGIN) return realFetch(input, init)
  if (url.pathname !== "/estimates") {
    return new Response("Not stubbed", { status: 404, statusText: "Not Found" })
  }
  const location = `${url.searchParams.get("a_lat")},${url.searchParams.get("a_lon")}`
  estimatesRequests.push(location)
  if (location !== bareLocation) return new Response("Unknown location", { status: 400 })
  return Response.json(estimatesBody(owner.ids.year, 265))
}

let owner: SeededUser
let stranger: SeededUser
let calendar: string
/** A field without any cultivation, so it has no main cultivation. */
let bareField: string

/** A small square at a location that no earlier run used. */
const square = () => {
  const lon = 5 + Math.random()
  const lat = 52 + Math.random()
  const d = 0.001
  return {
    type: "Polygon" as const,
    coordinates: [
      [
        [lon, lat],
        [lon + d, lat],
        [lon + d, lat + d],
        [lon, lat + d],
        [lon, lat],
      ],
    ],
  }
}

beforeAll(async () => {
  vi.stubGlobal("fetch", fetchStub)
  owner = await seedUserWithFarm("suggestions")
  stranger = await seedUserWithFarm("stranger")
  calendar = String(owner.ids.year)

  bareField = await addField(
    fdm,
    owner.user.id,
    owner.ids.farm,
    "Perceel zonder gewas",
    null,
    square(),
    new Date(Date.UTC(owner.ids.year - 1, 0, 1, 12)),
    "nl_01",
  )
  const field = (await getFields(fdm, owner.user.id, owner.ids.farm)).find(
    (candidate) => candidate.b_id === bareField,
  )
  if (!field) throw new Error("The field without a crop was not added")
  const [a_lon, a_lat] = field.b_centroid
  bareLocation = `${a_lat},${a_lon}`
})

beforeEach(() => {
  estimatesRequests.length = 0
})

afterAll(() => {
  vi.unstubAllGlobals()
})

function tableArgs() {
  return loaderArgs(`/farm/${owner.ids.farm}/${calendar}/field`, {
    b_id_farm: owner.ids.farm,
    calendar,
  })
}

function suggestionsArgs() {
  return loaderArgs(`/farm/${owner.ids.farm}/${calendar}/cultivation-suggestions`, {
    b_id_farm: owner.ids.farm,
    calendar,
  })
}

describe("fields table", () => {
  it("does not request suggestions, and asks the page to load them", async () => {
    signInAs(owner.user)
    const { status, data } = await runRoute(() => fieldsTableLoader(tableArgs()))
    expect(status).toBe(200)
    expect(estimatesRequests).toEqual([])

    const result = data as {
      loadCultivationSuggestions: boolean
      fieldsExtended: {
        b_id: string
        missingMainCultivation: boolean
        cultivationSuggestion?: unknown
      }[]
    }
    expect(result.loadCultivationSuggestions).toBe(true)
    expect(result.fieldsExtended.every((field) => !field.cultivationSuggestion)).toBe(true)
    // Only the field without a crop may show a suggestion
    expect(
      result.fieldsExtended.filter((field) => field.missingMainCultivation).map((f) => f.b_id),
    ).toEqual([bareField])
  })
})

describe("cultivation suggestions", () => {
  it("suggests a cultivation only for fields without a main cultivation", async () => {
    signInAs(owner.user)
    const { status, data } = await runRoute(() => suggestionsLoader(suggestionsArgs()))
    expect(status).toBe(200)

    const { suggestions } = data as { suggestions: Record<string, { b_lu_catalogue: string }> }
    expect(Object.keys(suggestions)).toEqual([bareField])
    expect(suggestions[bareField].b_lu_catalogue).toBe("nl_265")
    // Only the field without a main cultivation was looked up
    expect(estimatesRequests).toEqual([bareLocation])
  })

  it("gives a user without access to the farm no suggestions", async () => {
    // The suggestions are optional, so a refused read gives an empty list instead of an error
    // page over the fields table
    signInAs(stranger.user)
    const { status, data } = await runRoute(() => suggestionsLoader(suggestionsArgs()))
    expect(status).toBe(200)
    expect(data).toEqual({ suggestions: {} })
    expect(estimatesRequests).toEqual([])
  })
})
