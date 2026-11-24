import type { FdmServerType } from "@nmi-agro/fdm-core"
import {
  addFarm,
  addField,
  createFdmServer,
  enableCultivationCatalogue,
  getFields,
  syncCatalogues,
} from "@nmi-agro/fdm-core"
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it, vi } from "vitest"
import {
  getCultivationSuggestionResult,
  getCultivationSuggestionResultsForFarm,
} from "./cultivation-suggestion"

/**
 * The farm-level lookup must give the same result per field as the per-field lookup. The NMI
 * API is replaced by a stub that answers per location.
 */
describe("getCultivationSuggestionResultsForFarm", () => {
  const principal_id = `test-user-suggestions-${crypto.randomUUID()}`
  const year = 2025
  let fdm: FdmServerType
  let b_id_farm: string
  let b_id_grass: string
  let b_id_wheat: string
  let b_id_no_crop: string
  let b_id_failing: string
  let b_id_other_farm: string

  /** What the stub answers for a location: a BRP crop code, no crop for the year, or an error. */
  const answers = new Map<string, number | "none" | "error">()
  let inFlight = 0
  let maxInFlight = 0

  const estimatesBody = (b_lu_brp: number | undefined) => ({
    data: {
      a_al_ox: 1,
      a_ca_co: 1,
      a_ca_co_po: 1,
      a_caco3_if: 1,
      a_cec_co: 1,
      a_clay_mi: 1,
      a_cn_fr: 1,
      a_com_fr: 1,
      a_cu_cc: 1,
      a_fe_ox: 1,
      a_k_cc: 1,
      a_k_co: 1,
      a_k_co_po: 1,
      a_mg_cc: 1,
      a_mg_co: 1,
      a_mg_co_po: 1,
      a_n_pmn: 1,
      a_n_rt: 1,
      a_p_al: 1,
      a_p_cc: 1,
      a_p_ox: 1,
      a_p_rt: 1,
      a_p_sg: 1,
      a_p_wa: 1,
      a_ph_cc: 1,
      a_s_rt: 1,
      a_sand_mi: 1,
      a_silt_mi: 1,
      a_som_loi: 1,
      a_zn_cc: 1,
      b_soiltype_agr: "dekzand",
      b_gwl_class: "IIb",
      b_gwl_ghg: 1,
      b_gwl_glg: 1,
      b_c_st03: 1,
      b_som_potential: 1,
      b_c_st03_potential: 1,
      b_c_delta: 1,
      cultivations: b_lu_brp === undefined ? [] : [{ year, b_lu_brp }],
      cultivations_advanced: [],
    },
  })

  const fetchStub = vi.fn(async (url: string | URL | Request) => {
    const params = new URL(String(url)).searchParams
    const answer = answers.get(`${params.get("a_lat")},${params.get("a_lon")}`)
    inFlight++
    maxInFlight = Math.max(maxInFlight, inFlight)
    await new Promise((resolve) => setTimeout(resolve, 20))
    inFlight--
    if (answer === undefined || answer === "error") {
      return new Response("Bad request", { status: 400 })
    }
    return Response.json(estimatesBody(answer === "none" ? undefined : answer))
  })

  /** A small square at a location that no earlier test run used, so the cache is empty. */
  const square = (index: number) => {
    const lon = 5 + Math.random() * 0.5 + index * 0.01
    const lat = 52 + Math.random() * 0.5
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
    fdm = createFdmServer(
      inject("host"),
      inject("port"),
      inject("user"),
      inject("password"),
      inject("database"),
    )
    await syncCatalogues(fdm)

    b_id_farm = await addFarm(fdm, principal_id, "Suggestion farm", null, null, null)
    await enableCultivationCatalogue(fdm, principal_id, b_id_farm, "brp")
    const otherFarm = await addFarm(fdm, principal_id, "Other farm", null, null, null)

    const add = (farm: string, name: string, index: number) =>
      addField(
        fdm,
        principal_id,
        farm,
        name,
        null,
        square(index),
        new Date("2020-01-01T00:00:00Z"),
        "nl_01",
      )
    b_id_grass = await add(b_id_farm, "Grass", 0)
    b_id_wheat = await add(b_id_farm, "Wheat", 1)
    b_id_no_crop = await add(b_id_farm, "No crop", 2)
    b_id_failing = await add(b_id_farm, "Failing", 3)
    b_id_other_farm = await add(otherFarm, "Other farm field", 4)

    const answerById = new Map<string, number | "none" | "error">([
      [b_id_grass, 265],
      [b_id_wheat, 233],
      [b_id_no_crop, "none"],
      [b_id_failing, "error"],
      [b_id_other_farm, 265],
    ])
    for (const farm of [b_id_farm, otherFarm]) {
      for (const field of await getFields(fdm, principal_id, farm)) {
        const [a_lon, a_lat] = field.b_centroid
        answers.set(`${a_lat},${a_lon}`, answerById.get(field.b_id) ?? "error")
      }
    }

    vi.stubGlobal("fetch", fetchStub)
    vi.spyOn(console, "error").mockImplementation(() => {})
  }, 120_000)

  beforeEach(() => {
    fetchStub.mockClear()
    inFlight = 0
    maxInFlight = 0
  })

  afterAll(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("gives the same result per field as the per-field lookup", async () => {
    const b_ids = [b_id_wheat, b_id_grass, b_id_no_crop, b_id_failing, b_id_other_farm]
    const results = await getCultivationSuggestionResultsForFarm(
      fdm,
      principal_id,
      b_id_farm,
      b_ids,
      year,
      "test-key",
      { concurrency: 2 },
    )

    // One request per field of the farm, at most two at the same time
    expect(fetchStub).toHaveBeenCalledTimes(4)
    expect(maxInFlight).toBeLessThanOrEqual(2)

    expect([...results.keys()]).toEqual(b_ids)
    expect(results.get(b_id_grass)).toMatchObject({
      status: "suggested",
      suggestion: { b_lu_catalogue: "nl_265" },
    })
    expect(results.get(b_id_wheat)).toMatchObject({
      status: "suggested",
      suggestion: { b_lu_catalogue: "nl_233" },
    })
    expect(results.get(b_id_no_crop)).toEqual({ status: "no_estimate" })
    expect(results.get(b_id_failing)).toEqual({ status: "unavailable" })
    // A field of another farm is not part of this farm
    expect(results.get(b_id_other_farm)).toEqual({ status: "unavailable" })

    for (const b_id of [b_id_grass, b_id_wheat, b_id_no_crop, b_id_failing]) {
      expect(results.get(b_id)).toEqual(
        await getCultivationSuggestionResult(fdm, principal_id, b_id_farm, b_id, year, "test-key"),
      )
    }
  })

  it("is not configured without an NMI API key", async () => {
    const results = await getCultivationSuggestionResultsForFarm(
      fdm,
      principal_id,
      b_id_farm,
      [b_id_grass],
      year,
      undefined,
    )
    expect(results.get(b_id_grass)).toEqual({ status: "not_configured" })
    expect(fetchStub).not.toHaveBeenCalled()
  })

  it("is unavailable for a principal without access to the farm", async () => {
    const results = await getCultivationSuggestionResultsForFarm(
      fdm,
      `test-user-stranger-${crypto.randomUUID()}`,
      b_id_farm,
      [b_id_grass],
      year,
      "test-key",
    )
    expect(results.get(b_id_grass)).toEqual({ status: "unavailable" })
    expect(fetchStub).not.toHaveBeenCalled()
  })

  it("returns an empty map without fields", async () => {
    const results = await getCultivationSuggestionResultsForFarm(
      fdm,
      principal_id,
      b_id_farm,
      [],
      year,
      "test-key",
    )
    expect(results.size).toBe(0)
  })
})
