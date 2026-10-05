import { IndicatorsUnavailableError } from "@nmi-agro/fdm-calculator"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { FdmApiServices } from "../index"
import { createFdmApi } from "../index"
import { RATE_LIMITS } from "../rate-limit"

const mockAuth = { api: { verifyApiKey: vi.fn() } } as any

const mockFdm = {
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  onConflictDoUpdate: vi.fn().mockReturnThis(),
  returning: vi.fn().mockResolvedValue([{ count: 1, lastRequest: Date.now() }]),
} as any

const config = { appName: "Test App", appUrl: "https://test.example.com" }
const headers = { "x-api-key": "valid" }

function validKey() {
  mockAuth.api.verifyApiKey.mockResolvedValue({
    valid: true,
    error: null,
    key: { id: "key-1", referenceId: "user-1", name: "Test key" },
  })
}

function makeApp(services: Partial<FdmApiServices> = {}) {
  return createFdmApi(mockFdm, mockAuth, config, {
    getField: vi.fn().mockResolvedValue({ b_id: "field-1" }),
    getFarm: vi.fn().mockResolvedValue({ b_id_farm: "farm-1" }),
    getNmiApiKey: () => "secret-nmi-key",
    ...services,
  } as Partial<FdmApiServices>)
}

const indicator = {
  indicator_id: "C_N",
  status: 42,
  target: 50,
  index: 0.6,
  impact: 0.1,
  score: 0.7,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFdm.returning.mockResolvedValue([{ count: 1, lastRequest: Date.now() }])
  validKey()
})

describe("GET /fields/{b_id}/indicators", () => {
  const url = "/fields/field-1/indicators?year=2026"

  it("returns scores and aggregations", async () => {
    const getFieldIndicators = vi.fn().mockResolvedValue({
      b_id: "field-1",
      year: 2026,
      is_excluded: false,
      score: { indicators: [indicator], aggregations: [{ aggregation_id: "S_BLN", score: 0.7 }] },
    })
    const res = await makeApp({ getFieldIndicators }).request(url, { headers })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      b_id: "field-1",
      year: 2026,
      is_excluded: false,
      indicators: [indicator],
      aggregations: [{ aggregation_id: "S_BLN", score: 0.7 }],
    })
    expect(getFieldIndicators).toHaveBeenCalledWith(
      mockFdm,
      "user-1",
      "field-1",
      2026,
      "secret-nmi-key",
    )
  })

  it("returns an excluded field as 200 with empty arrays", async () => {
    const getFieldIndicators = vi
      .fn()
      .mockResolvedValue({ b_id: "field-1", year: 2026, is_excluded: true, score: null })
    const res = await makeApp({ getFieldIndicators }).request(url, { headers })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ is_excluded: true, indicators: [], aggregations: [] })
  })

  it.each(["", "?year=26", "?year=abcd", "?year=20266"])(
    "rejects year query '%s' with 400",
    async (q) => {
      const res = await makeApp().request(`/fields/field-1/indicators${q}`, { headers })
      expect(res.status).toBe(400)
    },
  )

  it("returns 401 without API key", async () => {
    mockAuth.api.verifyApiKey.mockResolvedValue({
      valid: false,
      error: { message: "x" },
      key: null,
    })
    const res = await makeApp().request(url)
    expect(res.status).toBe(401)
  })

  it("returns 403 when access is denied", async () => {
    const getField = vi.fn().mockRejectedValue(new Error("Permission denied"))
    const res = await makeApp({ getField }).request(url, { headers })
    expect(res.status).toBe(403)
  })

  it("returns 404 for a missing field", async () => {
    const getField = vi.fn().mockResolvedValue(null)
    const res = await makeApp({ getField }).request(url, { headers })
    expect(res.status).toBe(404)
  })

  it("returns 503 without leaking the NMI key or upstream details", async () => {
    const getFieldIndicators = vi.fn().mockRejectedValue(
      new IndicatorsUnavailableError("unavailable", {
        cause: new Error("upstream secret-nmi-key 500"),
      }),
    )
    const res = await makeApp({ getFieldIndicators }).request(url, { headers })
    expect(res.status).toBe(503)
    expect(res.headers.get("content-type")).toContain("application/problem+json")
    const text = await res.text()
    expect(text).not.toContain("secret-nmi-key")
    expect(text).not.toContain("upstream")
  })

  it("returns 429 when the nmi limit is exceeded and counts only the nmi bucket", async () => {
    mockFdm.returning.mockResolvedValue([
      { count: RATE_LIMITS.nmi + 1, lastRequest: Date.now() - 30_000 },
    ])
    const res = await makeApp().request(url, { headers })
    expect(res.status).toBe(429)
    expect(mockFdm.insert).toHaveBeenCalledTimes(1)
    expect(mockFdm.values).toHaveBeenCalledWith(
      expect.objectContaining({ key: "fdm-api:key-1:nmi" }),
    )
  })
})

describe("GET /farms/{b_id_farm}/indicators", () => {
  const url = "/farms/farm-1/indicators?year=2026"

  it("returns per-field scores and farm aggregates", async () => {
    const getFarmIndicators = vi.fn().mockResolvedValue({
      b_id_farm: "farm-1",
      year: 2026,
      fields: [{ b_id: "field-1", b_area: 2.5, score: { indicators: [indicator] } }],
      farm: { indicators: [{ indicator_id: "C_N", score: 0.7 }], aggregations: [] },
    })
    const res = await makeApp({ getFarmIndicators }).request(url, { headers })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.fields).toEqual([
      { b_id: "field-1", b_area: 2.5, indicators: [indicator], aggregations: [] },
    ])
    expect(body.farm.indicators).toEqual([{ indicator_id: "C_N", score: 0.7 }])
  })

  it("returns empty fields and aggregates for a farm without eligible fields", async () => {
    const getFarmIndicators = vi.fn().mockResolvedValue({
      b_id_farm: "farm-1",
      year: 2026,
      fields: [],
      farm: { indicators: [], aggregations: [] },
    })
    const res = await makeApp({ getFarmIndicators }).request(url, { headers })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      fields: [],
      farm: { indicators: [], aggregations: [] },
    })
  })

  it("returns 404 for a missing farm, 400 without year and 503 when a field fails", async () => {
    expect(
      (await makeApp({ getFarm: vi.fn().mockResolvedValue(null) }).request(url, { headers }))
        .status,
    ).toBe(404)
    expect((await makeApp().request("/farms/farm-1/indicators", { headers })).status).toBe(400)
    const getFarmIndicators = vi.fn().mockRejectedValue(new IndicatorsUnavailableError("x"))
    expect((await makeApp({ getFarmIndicators }).request(url, { headers })).status).toBe(503)
  })

  it("returns 403 when access is denied", async () => {
    const getFarm = vi.fn().mockRejectedValue(new Error("Permission denied"))
    expect((await makeApp({ getFarm }).request(url, { headers })).status).toBe(403)
  })
})

describe("GET /fields/{b_id}/measures/catalogue", () => {
  const url = "/fields/field-1/measures/catalogue?year=2026"
  const option = {
    m_id: "bln_BM1",
    m_source: "bln",
    m_name: "Example measure",
    m_description: "Full description",
    m_summary: null,
    m_source_url: null,
    m_conflicts: ["bln_BM2"],
    m_stage_applicability: "field",
    applicability: { status: "applicable", message: "" },
    active_measures: [],
    conflicts_with_active: [],
    selectable: true,
    predicted_impacts: [{ indicator_id: "C_N", measure_impact: 0.12 }],
    recommendation: {
      rank: 1,
      aggregate_impact: 0.12,
      indicator_impacts: [{ indicator_id: "C_N", measure_impact: 0.12 }],
    },
  }

  it("returns options with metadata, applicability and recommendation", async () => {
    const getFieldMeasureOptions = vi
      .fn()
      .mockResolvedValue({ b_id: "field-1", year: 2026, is_excluded: false, data: [option] })
    const res = await makeApp({ getFieldMeasureOptions }).request(url, { headers })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      b_id: "field-1",
      year: 2026,
      is_excluded: false,
      data: [option],
    })
  })

  it("keeps non-applicable options visible and recommendation null with empty advice", async () => {
    const blocked = {
      ...option,
      m_id: "bln_BM2",
      applicability: { status: "not yet applicable", message: "Not applicable this year." },
      selectable: false,
      predicted_impacts: [],
      recommendation: null,
      conflicts_with_active: ["bln_BM1"],
      active_measures: ["inst-1"],
    }
    const getFieldMeasureOptions = vi
      .fn()
      .mockResolvedValue({ b_id: "field-1", year: 2026, is_excluded: false, data: [blocked] })
    const res = await makeApp({ getFieldMeasureOptions }).request(url, { headers })
    const body = await res.json()
    expect(body.data[0]).toMatchObject({
      selectable: false,
      recommendation: null,
      applicability: { status: "not yet applicable" },
    })
  })

  it("returns excluded fields with empty data", async () => {
    const getFieldMeasureOptions = vi
      .fn()
      .mockResolvedValue({ b_id: "field-1", year: 2026, is_excluded: true, data: [] })
    const res = await makeApp({ getFieldMeasureOptions }).request(url, { headers })
    expect(await res.json()).toMatchObject({ is_excluded: true, data: [] })
  })

  it("maps errors: 400, 404, 503", async () => {
    expect(
      (await makeApp().request("/fields/field-1/measures/catalogue", { headers })).status,
    ).toBe(400)
    expect(
      (await makeApp({ getField: vi.fn().mockResolvedValue(null) }).request(url, { headers }))
        .status,
    ).toBe(404)
    const getFieldMeasureOptions = vi.fn().mockRejectedValue(new IndicatorsUnavailableError("x"))
    expect((await makeApp({ getFieldMeasureOptions }).request(url, { headers })).status).toBe(503)
  })

  it("does not interfere with the measure CRUD routes", async () => {
    const getMeasures = vi.fn().mockResolvedValue([])
    const res = await makeApp({ getMeasures }).request("/fields/field-1/measures", { headers })
    expect(res.status).toBe(200)
    expect(getMeasures).toHaveBeenCalled()
  })
})
