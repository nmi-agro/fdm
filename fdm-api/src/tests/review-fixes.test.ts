/**
 * Tests for fixes found in review:
 * - classifyError maps Zod validation errors to 400, like the REST validation hook;
 * - an aggregation of indicators keeps the other farms when one farm's indicators fail, and
 *   logs a failure that is not an unavailable indicator service;
 * - the soil analyses of a farm are sorted by date.
 */
import { IndicatorsUnavailableError } from "@nmi-agro/fdm-calculator"
import { afterEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"
import type { FdmApiServices } from "../index"
import { classifyError } from "../error"
import { createFdmApi } from "../index"

const config = { appName: "Test App", appUrl: "https://test.example.com" }
const headers = { "x-api-key": "valid" }

const mockFdm = {
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  onConflictDoUpdate: vi.fn().mockReturnThis(),
  returning: vi.fn().mockResolvedValue([{ count: 1, lastRequest: Date.now() }]),
} as any

const mockAuth = {
  api: {
    verifyApiKey: vi.fn().mockResolvedValue({
      valid: true,
      error: null,
      key: { id: "key-1", referenceId: "user-1", name: "Test key" },
    }),
  },
} as any

function makeApp(services: Partial<FdmApiServices>) {
  return createFdmApi(mockFdm, mockAuth, config, {
    countFieldsOfFarms: async () => ({}),
    ...services,
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe("classifyError", () => {
  it("maps a Zod validation error to 400 with the issues", () => {
    const parsed = z.object({ year: z.string() }).safeParse({ year: 2026 })
    expect(parsed.success).toBe(false)
    const result = classifyError(parsed.error)
    expect(result.status).toBe(400)
    expect(result.slug).toBe("validation-failed")
    expect(result.extras?.errors).toEqual(expect.any(Array))
  })
})

describe("indicators of an organization", () => {
  const farmIndicators = (b_id_farm: string) => ({
    b_id_farm,
    year: 2026,
    fields: [
      {
        b_id: `${b_id_farm}-f1`,
        b_area: 2,
        score: {
          indicators: [
            { indicator_id: "C_N", score: 0.8, index: 0.8, status: 1, target: 1, impact: 1 },
          ],
          aggregations: [{ aggregation_id: "S_BLN", score: 0.8 }],
        },
      },
    ],
    farm: { indicators: [], aggregations: [] },
  })

  it("keeps the other farms when the indicators of one farm are unavailable", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const app = makeApp({
      getNmiApiKey: () => "key",
      getFarmIdsOfOrganization: vi.fn().mockResolvedValue(["farm-a", "farm-b"]),
      getFarmIndicators: vi
        .fn()
        .mockResolvedValueOnce(farmIndicators("farm-a"))
        .mockRejectedValueOnce(new IndicatorsUnavailableError("indicator score is unavailable")),
    } as never)
    const res = await app.request("/organizations/org-1/indicators?year=2026", { headers })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.farms).toHaveLength(2)
    expect(body.farms[0]).toMatchObject({ b_id_farm: "farm-a", error: null })
    expect(body.farms[1]).toMatchObject({ b_id_farm: "farm-b", area_weighted: null })
    expect(body.farms[1].error).toEqual(expect.any(String))
  })

  it("logs an unexpected failure of one farm before marking it as failed", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    const app = makeApp({
      getNmiApiKey: () => "key",
      getFarmIdsOfOrganization: vi.fn().mockResolvedValue(["farm-a", "farm-b"]),
      getFarmIndicators: vi
        .fn()
        .mockResolvedValueOnce(farmIndicators("farm-a"))
        .mockRejectedValueOnce(new Error("relation does not exist")),
    } as never)
    const res = await app.request("/organizations/org-1/indicators?year=2026", { headers })
    expect(res.status).toBe(200)
    expect((await res.json()).farms[1].error).toEqual(expect.any(String))
    expect(String(error.mock.calls.at(-1)?.[0])).toMatch(
      /^\[fdm-api\] error_id=\S+ A farm in the indicator aggregation failed/,
    )
  })

  it("answers 503 without an NMI API key, before calculating any farm", async () => {
    const getFarmIndicators = vi.fn()
    const app = makeApp({
      getNmiApiKey: () => undefined,
      getFarmIdsOfOrganization: vi.fn().mockResolvedValue(["farm-a"]),
      getFarmIndicators,
    } as never)
    const res = await app.request("/organizations/org-1/indicators?year=2026", { headers })
    expect(res.status).toBe(503)
    expect(getFarmIndicators).not.toHaveBeenCalled()
  })
})

describe("soil analyses of a farm", () => {
  const analysis = (a_id: string, date: string) => ({
    a_id,
    a_date: new Date(`${date}T00:00:00Z`),
    a_source: "other",
    a_depth_upper: 0,
    a_depth_lower: 30,
    b_sampling_date: new Date(`${date}T00:00:00Z`),
    b_id_sampling: `s-${a_id}`,
  })

  it("sorts the analyses by date, not by the name of the weekday", async () => {
    // 2024-01-20 is a Saturday and 2024-01-22 a Monday: sorting the text of the dates would put
    // the Monday first.
    const app = makeApp({
      getSoilAnalysesForFarm: vi.fn().mockResolvedValue(
        new Map([
          ["field-1", [analysis("a-mon", "2024-01-22")]],
          ["field-2", [analysis("a-sat", "2024-01-20")]],
        ]),
      ),
    } as never)
    const res = await app.request("/farms/farm-1/soil-analyses", { headers })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.map((item: { a_id: string }) => item.a_id)).toEqual(["a-sat", "a-mon"])
  })
})
