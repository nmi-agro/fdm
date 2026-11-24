/**
 * The mineralization overview of a farm (`farm.$b_id_farm.$calendar.mineralization._index`):
 * the fields are calculated together, with one weather forecast per rounded location and one
 * batched cache lookup for the Dyna calculations, and give the same outcomes as calculating each
 * field on its own.
 *
 * The NMI API is replaced by a stub that answers Dyna and the weather forecast with small valid
 * responses and counts the requests.
 */
import { getDynaV2, getWeatherForecast } from "@nmi-agro/fdm-calculator"
import { sql } from "drizzle-orm"
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import type { FieldMineralizationOutcome } from "~/lib/mineralization"
import {
  calculateFarmMineralization,
  calculateFieldMineralization,
  type FarmMineralizationContext,
  loadFarmMineralizationContext,
} from "~/integrations/mineralization.server"
import { fdm } from "~/lib/fdm.server"
import { loader } from "~/routes/farm.$b_id_farm.$calendar.mineralization._index"
import { loaderArgs, runRoute, type SeededUser, seedUserWithFarm, withNmiApiKey } from "../helpers"
import { signInAs } from "../session"

// The calculations only call the NMI API when a key is configured
withNmiApiKey()

const NMI_ORIGIN = "https://api.nmi-agro.nl"
const DYNA_PATH = "/bemestingsplan/dyna/v2"
const WEATHER_PATH = "/regras/v3/forecast/weather"

/** The Dyna requests (their `field`) and forecast locations since the last reset. */
const dynaRequests: { a_lat: number; a_lon: number }[] = []
const forecastRequests: string[] = []
/** The successful answers since the last reset; each adds one cache entry. */
let successfulRequests = 0
/** Latitude of the field for which the stubbed Dyna answers with an error. */
let failingLatitude: number | null = null

const realFetch = globalThis.fetch

/** Answers like the NMI API, with results that depend on the request. */
const fetchStub: typeof fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input))
  if (url.origin !== NMI_ORIGIN) return realFetch(input, init)
  if (url.pathname === DYNA_PATH) {
    const body = JSON.parse(init?.body as string) as {
      field: { a_lat: number; a_lon: number }
      cultivations?: { b_lu_start?: string }[]
    }
    dynaRequests.push(body.field)
    if (body.field.a_lat === failingLatitude) {
      return Response.json(
        { success: false, status: 400, message: "test", data: null },
        { status: 400 },
      )
    }
    successfulRequests++
    const start = body.cultivations?.[0]?.b_lu_start ?? "2026-01-01"
    const nw = Math.round(body.field.a_lat * 10)
    return Response.json({
      success: true,
      data: {
        calculation_dyna: [
          { b_date_calculation: start, b_nw: nw, b_n_uptake: 10, b_no3_leach: 1 },
          {
            b_date_calculation: `${start.slice(0, 4)}-12-31`,
            b_nw: nw + 50,
            b_n_uptake: 60,
            b_no3_leach: 3,
          },
        ],
        nitrogen_balance: { b_nw: nw + 50, b_n_uptake: 60 },
      },
    })
  }
  if (url.pathname === WEATHER_PATH) {
    const a_lat = url.searchParams.get("a_lat")
    const a_lon = url.searchParams.get("a_lon")
    const date = url.searchParams.get("date") ?? ""
    forecastRequests.push(`${a_lat},${a_lon}`)
    successfulRequests++
    return Response.json({
      data: {
        forecast: [0, 1, 2].map((offset) => ({
          date: new Date(Date.parse(`${date}T00:00:00Z`) + offset * 86_400_000)
            .toISOString()
            .slice(0, 10),
          w_temp_min_day: 2 + offset,
          w_temp_max_day: 9 + offset,
          w_temp_mean_day: 5 + offset,
          w_prec_sum_day: Number(a_lat) / 10,
          w_et_ref_day: 0.5,
          w_icon: 1,
        })),
        notifications: [],
      },
    })
  }
  return new Response("Not stubbed", { status: 404, statusText: "Not Found" })
}

const mineralizationCacheEntries = sql`calculation_function in ('requestDynaV2', 'requestWeatherForecast')`

async function countMineralizationCacheEntries(): Promise<number> {
  const rows = await fdm.execute<{ n: number }>(
    sql`select count(*)::int as n from "fdm-calculator".calculation_cache where ${mineralizationCacheEntries}`,
  )
  return Number(rows[0]?.n ?? 0)
}

/** Removes the cached Dyna results and forecasts, so the next calculation requests them. */
async function clearCache(): Promise<void> {
  // The cache writes results about a second after a calculation, without a signal when they
  // land. Every successful request since the last reset adds one entry (the earlier entries
  // were deleted, and no other test file stubs these endpoints), so wait until that many
  // entries exist before the delete, and fail after 10 seconds.
  const expected = successfulRequests
  const deadline = Date.now() + 10_000
  while ((await countMineralizationCacheEntries()) < expected) {
    if (Date.now() > deadline) {
      throw new Error(`Expected ${expected} cache entries before clearing the cache`)
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  await fdm.execute(
    sql`delete from "fdm-calculator".calculation_cache
      where calculation_function in ('requestDynaV2', 'requestWeatherForecast')`,
  )
  successfulRequests = 0
  dynaRequests.length = 0
  forecastRequests.length = 0
}

let owner: SeededUser
let stranger: SeededUser

beforeAll(async () => {
  vi.stubGlobal("fetch", fetchStub)
  owner = await seedUserWithFarm("mineral")
  stranger = await seedUserWithFarm("stranger")
})

afterEach(() => {
  failingLatitude = null
  vi.restoreAllMocks()
})

afterAll(() => {
  vi.unstubAllGlobals()
})

const params = () => ({ b_id_farm: owner.ids.farm, calendar: String(owner.ids.year) })
const path = () => `/farm/${owner.ids.farm}/${owner.ids.year}/mineralization`

/** Runs the loader and waits for the streamed outcome of every row. */
async function loadOutcomes(): Promise<FieldMineralizationOutcome[]> {
  const { status, data } = await runRoute(() => loader(loaderArgs(path(), params())))
  expect(status).toBe(200)
  const { rows } = data as {
    rows: { b_id: string; outcome: Promise<FieldMineralizationOutcome> }[]
  }
  const outcomes = await Promise.all(rows.map((row) => row.outcome))
  // Each outcome belongs to the field of its own row
  expect(outcomes.map((outcome) => outcome.b_id)).toEqual(rows.map((row) => row.b_id))
  return outcomes
}

/** Context of the owner's farm. */
function loadContext(): Promise<FarmMineralizationContext> {
  return loadFarmMineralizationContext({
    principal_id: owner.user.id,
    b_id_farm: owner.ids.farm,
    year: owner.ids.year,
  })
}

describe("loader", () => {
  it("refuses another user's farm", async () => {
    signInAs(stranger.user)
    const { status } = await runRoute(() => loader(loaderArgs(path(), params())))
    expect(status).toBe(403)
  })

  it("calculates all fields together and gives the same outcomes as per field", async () => {
    signInAs(owner.user)
    const dynaMany = vi.spyOn(getDynaV2, "many")
    const forecastMany = vi.spyOn(getWeatherForecast, "many")

    await clearCache()
    const outcomes = await loadOutcomes()
    const ready = outcomes.filter((outcome) => outcome.status === "ok")
    expect(ready.length).toBeGreaterThan(0)

    // One batched cache lookup for Dyna and for the forecasts, with every ready field in it
    expect(dynaMany).toHaveBeenCalledTimes(1)
    expect(dynaMany.mock.calls[0][1]).toHaveLength(ready.length)
    expect(forecastMany).toHaveBeenCalledTimes(1)
    expect(forecastMany.mock.calls[0][1]).toHaveLength(ready.length)
    // One Dyna request per ready field, one forecast per rounded location
    expect(dynaRequests).toHaveLength(ready.length)
    expect(new Set(forecastRequests).size).toBe(forecastRequests.length)
    for (const outcome of ready) {
      expect(outcome.forecast).not.toBeNull()
    }

    // Calculating each field on its own gives the same outcomes
    await clearCache()
    const ctx = await loadContext()
    const perField = await Promise.all(
      outcomes.map((outcome) =>
        calculateFieldMineralization(ctx, outcome.b_id, owner.user.id, owner.ids.farm),
      ),
    )
    expect(perField).toEqual(outcomes)
  })

  it("requests one forecast for fields at the same location", async () => {
    const ctx = await loadContext()
    const field = ctx.fields.find((f) => ctx.data.get(f.b_id)?.field.b_centroid)
    expect(field).toBeDefined()
    if (!field) return
    // A second field on the same spot
    const copy = { ...field, b_id: `${field.b_id}-copy`, b_name: "Kopie" }
    const data = ctx.data.get(field.b_id)
    if (!data) throw new Error("No data")
    ctx.fields.push(copy)
    ctx.data.set(copy.b_id, { ...data, field: { ...data.field, b_id: copy.b_id } })

    await clearCache()
    const [original, duplicate] = await Promise.all(
      calculateFarmMineralization(ctx, [field.b_id, copy.b_id], owner.user.id, owner.ids.farm),
    )
    expect(original.status).toBe("ok")
    expect(duplicate.status).toBe("ok")
    expect(forecastRequests).toHaveLength(1)
  })

  it("keeps the other fields when one field fails", async () => {
    const ctx = await loadContext()
    const ids = ctx.fields.map((f) => f.b_id)
    await clearCache()
    const outcomes = await Promise.all(
      calculateFarmMineralization(ctx, ids, owner.user.id, owner.ids.farm),
    )
    const ready = outcomes.filter((outcome) => outcome.status === "ok")
    expect(ready.length).toBeGreaterThan(1)

    // The first ready field fails at Dyna; the others are still calculated
    const centroid = ctx.data.get(ready[0].b_id)?.field.b_centroid
    if (!centroid) throw new Error("No centroid")
    failingLatitude = centroid[1]
    await clearCache()
    const withFailure = await Promise.all(
      calculateFarmMineralization(ctx, ids, owner.user.id, owner.ids.farm),
    )
    const failed = withFailure.find((outcome) => outcome.b_id === ready[0].b_id)
    expect(failed).toMatchObject({ status: "error", message: expect.stringContaining("Dyna") })
    for (const outcome of withFailure) {
      if (outcome.b_id === ready[0].b_id) continue
      expect(outcome).toEqual(outcomes.find((o) => o.b_id === outcome.b_id))
    }
  })
})
