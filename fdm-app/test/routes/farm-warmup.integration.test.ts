/**
 * The calculation warm-up of a farm (`api.farm.$b_id_farm.warm`): access checks, and that a
 * warmed farm opens its indicators, measures, nutrient advice, usage norms, nitrogen balance and
 * organic matter balance pages without requests to the NMI API and without new cache entries.
 *
 * The NMI API is replaced by a stub that answers every endpoint with a small valid response.
 */
import { sql } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { fdm } from "~/lib/fdm.server"
import { action } from "~/routes/api.farm.$b_id_farm.warm"
import { loader as nitrogenBalanceLoader } from "~/routes/farm.$b_id_farm.$calendar.balance.nitrogen._index"
import { loader as organicMatterBalanceLoader } from "~/routes/farm.$b_id_farm.$calendar.balance.organic-matter._index"
import { loader as indicatorsLoader } from "~/routes/farm.$b_id_farm.$calendar.indicators._index"
import { loader as measuresLoader } from "~/routes/farm.$b_id_farm.$calendar.measures._index"
import { loader as normsLoader } from "~/routes/farm.$b_id_farm.$calendar.norms._index"
import { loader as nutrientAdviceLoader } from "~/routes/farm.$b_id_farm.$calendar.nutrient_advice._index"
import { actionArgs, loaderArgs, runRoute, type SeededUser, seedUserWithFarm } from "../helpers"
import { signInAs } from "../session"

// The calculations only call the NMI API when a key is configured
vi.mock("~/integrations/nmi.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/integrations/nmi.server")>()
  return { ...actual, getNmiApiKey: () => "test-key" }
})

const NMI_ORIGIN = "https://api.nmi-agro.nl"

/** Small valid answers of the NMI endpoints that the calculation pages use. */
const NMI_RESPONSES: Record<string, unknown> = {
  "/maatwerk/bln3/score/field": {
    success: true,
    data: { indicator: [{ indicator: "I_C_N", score: 0.5 }], aggregations: [] },
  },
  "/maatwerk/bln3/measure/applicability": { success: true, data: { applicability: [] } },
  "/maatwerk/bln3/measure/advice": { success: true, data: { indicator_advice: [] } },
  "/bemestingsplan/nutrients": {
    data: {
      year: {
        d_n_req: 150,
        d_p_req: 60,
        d_k_req: 120,
        d_c_req: 0,
        d_ca_req: 0,
        d_s_req: 20,
        d_mg_req: 10,
        d_cu_req: 0,
        d_zn_req: 0,
        d_co_req: 0,
        d_mn_req: 0,
        d_mo_req: 0,
        d_na_req: 0,
        d_b_req: 0,
      },
    },
  },
}

const realFetch = globalThis.fetch
/** The paths of the NMI requests since the last reset. */
const nmiRequests: string[] = []

const fetchStub: typeof fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input))
  if (url.origin !== NMI_ORIGIN) return realFetch(input, init)
  nmiRequests.push(url.pathname)
  const body = NMI_RESPONSES[url.pathname]
  return body
    ? Response.json(body)
    : new Response("Not stubbed", { status: 404, statusText: "Not Found" })
}

let owner: SeededUser
let stranger: SeededUser

beforeAll(async () => {
  vi.stubGlobal("fetch", fetchStub)
  owner = await seedUserWithFarm("warmup")
  stranger = await seedUserWithFarm("stranger")
})

afterAll(() => {
  vi.unstubAllGlobals()
})

const warm = (b_id_farm: string, form: Record<string, string>) =>
  runRoute(() => action(actionArgs(`/api/farm/${b_id_farm}/warm`, { b_id_farm }, form)))

/**
 * The cache entries of the calculations on these pages for the farm of `owner`: the NMI
 * requests, the norms and the balances.
 *
 * Only this file stubs the NMI endpoints below, so their entries are its own. The norms and
 * balances are also calculated by other test files that run at the same time (the organization
 * pages), so those entries count only when their input names this farm or one of its fields.
 */
function pageCacheEntries() {
  const ids = [owner.ids.farm, ...Object.values(owner.ids.fields)].filter(
    (id): id is string => !!id,
  )
  return sql`(calculation_function in (
      'requestBln3Score', 'requestBln3MeasureApplicability', 'requestBln3MeasureAdvice',
      'requestNutrientAdvice'
    ) or ((calculation_function in ('calculateNitrogenBalanceField', 'calculateOrganicMatterBalanceField')
      or calculation_function like 'calculateNL%') and input::text ~ ${ids.join("|")}))`
}

async function countCacheEntries(): Promise<number> {
  const rows = await fdm.execute<{ n: number }>(
    sql`select count(*)::int as n from "fdm-calculator".calculation_cache where ${pageCacheEntries()}`,
  )
  return Number(rows[0]?.n ?? 0)
}

/**
 * Waits until the delayed cache writes have landed: the cache collects new results for about a
 * second before writing them.
 */
async function waitForCacheWrites(): Promise<number> {
  await new Promise((resolve) => setTimeout(resolve, 1500))
  let previous = await countCacheEntries()
  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, 500))
    const current = await countCacheEntries()
    if (current === previous) return current
    previous = current
  }
}

/** Waits for every promise in the data of a loader, such as streamed rows. */
async function settleStreamedData(value: unknown, seen = new Set<unknown>()): Promise<void> {
  if (typeof value !== "object" || value === null || seen.has(value)) return
  seen.add(value)
  if (value instanceof Promise) {
    const settled = await Promise.allSettled([value])
    if (settled[0].status === "fulfilled") await settleStreamedData(settled[0].value, seen)
    return
  }
  await Promise.all(Object.values(value).map((item) => settleStreamedData(item, seen)))
}

describe("action", () => {
  it("refuses another user's farm", async () => {
    signInAs(stranger.user)
    const { status } = await warm(owner.ids.farm, { calendar: String(owner.ids.year) })
    expect(status).toBe(403)
  })

  it("refuses a signed-out visitor", async () => {
    signInAs(null)
    const { status } = await warm(owner.ids.farm, { calendar: String(owner.ids.year) })
    expect(status).toBe(401)
  })

  it("rejects an unsupported year", async () => {
    signInAs(owner.user)
    for (const calendar of ["1900", "2026.0", " 2026", "all"]) {
      const { status } = await warm(owner.ids.farm, { calendar })
      expect(status, calendar).toBe(400)
    }
    const { status } = await warm(owner.ids.farm, {})
    expect(status).toBe(400)
  })

  it("fills the cache that the calculation pages read", async () => {
    signInAs(owner.user)
    const b_id_farm = owner.ids.farm
    const calendar = String(owner.ids.year)

    // The cache key depends only on the inputs, and every run seeds the same field data, so an
    // earlier run would already have warmed this farm
    await fdm.execute(
      sql`delete from "fdm-calculator".calculation_cache where ${pageCacheEntries()}`,
    )
    nmiRequests.length = 0
    const { status } = await warm(b_id_farm, { calendar })
    expect(status).toBe(204)
    // Every calculation that calls the NMI API ran
    expect(new Set(nmiRequests)).toEqual(new Set(Object.keys(NMI_RESPONSES)))
    const entriesAfterWarmup = await waitForCacheWrites()
    // The balances call no external API; check that they were calculated and cached too
    const balanceRows = await fdm.execute<{ calculation_function: string }>(
      sql`select distinct calculation_function from "fdm-calculator".calculation_cache
        where calculation_function in ('calculateNitrogenBalanceField', 'calculateOrganicMatterBalanceField')`,
    )
    expect(new Set(balanceRows.map((row) => row.calculation_function))).toEqual(
      new Set(["calculateNitrogenBalanceField", "calculateOrganicMatterBalanceField"]),
    )

    nmiRequests.length = 0
    const params = { b_id_farm, calendar }
    for (const [page, loader] of [
      ["indicators", indicatorsLoader],
      ["measures", measuresLoader],
      ["nutrient_advice", nutrientAdviceLoader],
      ["norms", normsLoader],
      ["balance/nitrogen", nitrogenBalanceLoader],
      ["balance/organic-matter", organicMatterBalanceLoader],
    ] as const) {
      const { status: pageStatus, data } = await runRoute(() =>
        loader(loaderArgs(`/farm/${b_id_farm}/${calendar}/${page}`, params)),
      )
      expect(pageStatus, page).toBe(200)
      await settleStreamedData(data)
    }

    expect(nmiRequests).toEqual([])
    expect(await waitForCacheWrites()).toBe(entriesAfterWarmup)
  })
})
