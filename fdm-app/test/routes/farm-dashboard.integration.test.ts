/**
 * The farm dashboard (`farm.$b_id_farm._index`) looks up the BRP-based cultivation suggestions
 * of the fields without a main cultivation for the whole farm at once, and does not wait for
 * them: the loader returns a promise. The results per field must be the same as those of the
 * per-field lookup, and accepting the suggestions adds them as before.
 *
 * The NMI API is replaced by a stub that answers per location. Every run uses new locations, so
 * the estimates are never cached yet and the requests can be counted. The API key is set in the
 * server config with `withNmiApiKey` and `setNmiApiKey`.
 */
import { addField, getCultivationsForFarm, getFields } from "@nmi-agro/fdm-core"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import type { CultivationSuggestionResult } from "~/lib/cultivation-suggestion.server"
import { getCultivationSuggestionResult } from "~/lib/cultivation-suggestion.server"
import { fdm } from "~/lib/fdm.server"
import { getMainCultivation } from "~/lib/hoofdteelt.server"
import { action, loader } from "~/routes/farm.$b_id_farm._index"
import {
  loaderArgs,
  runRoute,
  type SeededUser,
  seedUserWithFarm,
  setNmiApiKey,
  TEST_ORIGIN,
  withNmiApiKey,
} from "../helpers"
import { signInAs } from "../session"

// Each test starts with a key (see `beforeEach`); one test removes it
withNmiApiKey()

const NMI_ORIGIN = "https://api.nmi-agro.nl"
const realFetch = globalThis.fetch

/** The BRP crop code the stub answers per location (`lat,lon`), or `none` for no crop. */
const cropByLocation = new Map<string, number | "none">()
let estimatesRequests = 0
/** Holds the answers of the NMI API back until it resolves. */
let gate: Promise<void> = Promise.resolve()

const estimatesBody = (year: number, b_lu_brp: number | undefined) => ({
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
    cultivations: b_lu_brp === undefined ? [] : [{ year, b_lu_brp }],
    cultivations_advanced: [],
  },
})

const fetchStub: typeof fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input))
  if (url.origin !== NMI_ORIGIN) return realFetch(input, init)
  if (url.pathname !== "/estimates") {
    return new Response("Not stubbed", { status: 404, statusText: "Not Found" })
  }
  estimatesRequests++
  await gate
  const crop = cropByLocation.get(
    `${url.searchParams.get("a_lat")},${url.searchParams.get("a_lon")}`,
  )
  if (crop === undefined) return new Response("Unknown location", { status: 400 })
  return Response.json(estimatesBody(owner.ids.year, crop === "none" ? undefined : crop))
}

let owner: SeededUser
/** A field without a main cultivation for which the NMI API knows a BRP crop (grassland). */
let grassField: string
/** A field without a main cultivation for which the NMI API knows no crop in the year. */
let noCropField: string

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
  owner = await seedUserWithFarm("dashboard")
  const start = new Date(Date.UTC(owner.ids.year - 1, 0, 1, 12))
  grassField = await addField(
    fdm,
    owner.user.id,
    owner.ids.farm,
    "Grasland zonder gewas",
    null,
    square(),
    start,
    "nl_01",
  )
  noCropField = await addField(
    fdm,
    owner.user.id,
    owner.ids.farm,
    "Perceel zonder BRP-gewas",
    null,
    square(),
    start,
    "nl_01",
  )

  for (const field of await getFields(fdm, owner.user.id, owner.ids.farm)) {
    const [a_lon, a_lat] = field.b_centroid
    if (field.b_id === grassField) cropByLocation.set(`${a_lat},${a_lon}`, 265)
    if (field.b_id === noCropField) cropByLocation.set(`${a_lat},${a_lon}`, "none")
  }
})

beforeEach(() => {
  setNmiApiKey("test-key")
  estimatesRequests = 0
  gate = Promise.resolve()
})

afterAll(() => {
  vi.unstubAllGlobals()
})

function dashboardArgs() {
  return loaderArgs(`/farm/${owner.ids.farm}?calendar=${owner.ids.year}`, {
    b_id_farm: owner.ids.farm,
  })
}

type DashboardData = {
  fieldsMissingCultivation: number
  fieldsMissingCultivationDetails: Promise<
    { b_id: string; b_name: string; result: CultivationSuggestionResult }[]
  >
}

describe("farm dashboard", () => {
  it("renders without waiting for the suggestions, which match the per-field lookup", async () => {
    let release!: () => void
    gate = new Promise((resolve) => {
      release = resolve
    })
    signInAs(owner.user)

    // The loader returns while the NMI API has not answered yet
    const { status, data } = await runRoute(() => loader(dashboardArgs()))
    expect(status).toBe(200)
    const result = data as DashboardData
    expect(result.fieldsMissingCultivation).toBe(2)
    const pending = Symbol("pending")
    expect(
      await Promise.race([
        result.fieldsMissingCultivationDetails,
        new Promise((resolve) => setTimeout(() => resolve(pending), 50)),
      ]),
    ).toBe(pending)

    release()
    const details = await result.fieldsMissingCultivationDetails
    // One request per field, as before
    expect(estimatesRequests).toBe(2)

    expect(details.map((field) => field.b_id).sort()).toEqual([grassField, noCropField].sort())
    const byField = new Map(details.map((field) => [field.b_id, field]))
    expect(byField.get(grassField)?.b_name).toBe("Grasland zonder gewas")
    expect(byField.get(grassField)?.result).toMatchObject({
      status: "suggested",
      suggestion: { b_lu_catalogue: "nl_265" },
    })
    expect(byField.get(noCropField)?.result).toEqual({ status: "no_estimate" })

    for (const b_id of [grassField, noCropField]) {
      expect(byField.get(b_id)?.result).toEqual(
        await getCultivationSuggestionResult(
          fdm,
          owner.user.id,
          owner.ids.farm,
          b_id,
          owner.ids.year,
          "test-key",
        ),
      )
    }
  })

  it("has no suggestions without an NMI API key", async () => {
    setNmiApiKey(undefined)
    signInAs(owner.user)
    const { data } = await runRoute(() => loader(dashboardArgs()))
    const details = await (data as DashboardData).fieldsMissingCultivationDetails
    expect(details.map((field) => field.result.status)).toEqual([
      "not_configured",
      "not_configured",
    ])
    expect(estimatesRequests).toBe(0)
  })

  it("adds the suggested main cultivations of the selected fields", async () => {
    signInAs(owner.user)
    const path = `/farm/${owner.ids.farm}`
    const body = new URLSearchParams([
      ["intent", "accept_all_suggestions"],
      ["calendar", String(owner.ids.year)],
      ["selected_b_id", grassField],
      ["selected_b_id", noCropField],
    ])
    const url = new URL(path, TEST_ORIGIN)
    const { status, data } = await runRoute(() =>
      action({
        request: new Request(url, { method: "POST", body }),
        url,
        params: { b_id_farm: owner.ids.farm },
        context: {},
        unstable_pattern: "",
      } as unknown as Parameters<typeof action>[0]),
    )
    expect(status).toBe(200)
    expect(data).toEqual({ acceptedCount: 1, failedCount: 0 })

    const cultivations = await getCultivationsForFarm(fdm, owner.user.id, owner.ids.farm)
    expect(
      getMainCultivation(cultivations.get(grassField) ?? [], String(owner.ids.year))
        ?.b_lu_catalogue,
    ).toBe("nl_265")
    expect(cultivations.get(noCropField) ?? []).toEqual([])
  })
})
