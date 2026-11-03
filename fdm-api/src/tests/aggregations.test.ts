import { beforeEach, describe, expect, it, vi } from "vitest"
import type { FdmApiServices } from "../index"
import { createFdmApi } from "../index"

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

const group = {
  b_id_group: "g-1",
  b_id_organization: "org-1",
  b_name_group: "Studiegroep",
  b_id_farms: ["farm-a", "farm-b", "farm-old"],
  memberships: [
    { b_id_farm: "farm-a", b_group_joined: new Date("2024-01-01"), b_group_leaved: null },
    { b_id_farm: "farm-b", b_group_joined: new Date("2026-03-01"), b_group_leaved: null },
    {
      b_id_farm: "farm-old",
      b_group_joined: new Date("2020-01-01"),
      b_group_leaved: new Date("2025-01-01"),
    },
  ],
  created: new Date(),
  updated: null,
}

const fieldScore = (b_id: string, area: number, score: number) => ({
  b_id,
  b_area: area,
  score: {
    indicators: [{ indicator_id: "C_N", score, index: score, status: 1, target: 1, impact: 1 }],
    aggregations: [{ aggregation_id: "S_BLN", score }],
  },
})

const farmIndicators = (b_id_farm: string, fields: ReturnType<typeof fieldScore>[]) => ({
  b_id_farm,
  year: 2026,
  fields,
  farm: { indicators: [], aggregations: [] },
})

const measureSummary = (b_id_farm: string, fieldCount: number, start: string) => ({
  b_id_farm,
  eligibleFields: [{ b_id: `${b_id_farm}-f1` }],
  measures: [
    { m_id: "m-1", m_name: "Bufferstrook", m_start: new Date(start), m_end: null, fieldCount },
  ],
  mainCultivations: [
    { b_lu_catalogue: "nl_265", b_lu_name: "Grasland", b_lu_croprotation: "grass", b_area: 4 },
  ],
})

function makeApp(services: Partial<FdmApiServices> = {}) {
  return createFdmApi(mockFdm, mockAuth, config, {
    getFarmGroup: vi.fn().mockResolvedValue(group),
    getFarmIdsOfOrganization: vi.fn().mockResolvedValue(["farm-a", "farm-b", "farm-c"]),
    getNmiApiKey: () => "key",
    ...services,
  })
}

describe("farm group aggregations", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    validKey()
  })

  it("calculates the nitrogen balance of the farms in the group in the year", async () => {
    const getNitrogenBalanceForFarms = vi.fn().mockResolvedValue({
      total: { balance: 10 },
      farms: [
        { b_id_farm: "farm-a", balance: { balance: 12 } },
        { b_id_farm: "farm-b", errorMessage: "No fields in input" },
      ],
    })
    const app = makeApp({ getNitrogenBalanceForFarms } as any)
    const res = await app.request("/farm-groups/g-1/calculations/nitrogen-balance?year=2026", {
      headers,
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(getNitrogenBalanceForFarms.mock.calls[0]?.[1]).toBe("user-1")
    expect(getNitrogenBalanceForFarms.mock.calls[0]?.[2]).toEqual(["farm-a", "farm-b"])
    expect(body.total).toEqual({ balance: 10 })
    expect(body.farms).toEqual([
      { b_id_farm: "farm-a", balance: { balance: 12 }, error: null },
      { b_id_farm: "farm-b", error: "The farm has no fields in this year." },
    ])
  })

  it("limits the farms to the requested ones", async () => {
    const getOrganicMatterBalanceForFarms = vi
      .fn()
      .mockResolvedValue({ total: { balance: 1 }, farms: [] })
    const app = makeApp({ getOrganicMatterBalanceForFarms } as any)
    const res = await app.request(
      "/farm-groups/g-1/calculations/organic-matter-balance?year=2026&b_id_farm=farm-b",
      { headers },
    )
    expect(res.status).toBe(200)
    expect(getOrganicMatterBalanceForFarms.mock.calls[0]?.[2]).toEqual(["farm-b"])
  })

  it("returns 422 for a farm that is not part of the group in the year", async () => {
    const app = makeApp({ getNitrogenBalanceForFarms: vi.fn() } as any)
    const res = await app.request(
      "/farm-groups/g-1/calculations/nitrogen-balance?year=2026&b_id_farm=farm-old",
      { headers },
    )
    expect(res.status).toBe(422)
  })

  it("returns the indicator scores per farm and for the whole group", async () => {
    const getFarmIndicators = vi
      .fn()
      .mockResolvedValueOnce(
        farmIndicators("farm-a", [fieldScore("f1", 1, 0.4), fieldScore("f2", 1, 0.8)]),
      )
      .mockResolvedValueOnce(farmIndicators("farm-b", [fieldScore("f3", 2, 0.9)]))
    const app = makeApp({ getFarmIndicators } as any)
    const res = await app.request("/farm-groups/g-1/indicators?year=2026", { headers })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.farms[0].minimum.indicators[0]).toMatchObject({ indicator_id: "C_N", score: 0.4 })
    // Area-weighted over all fields: (0.4 * 1 + 0.8 * 1 + 0.9 * 2) / 4 = 0.75.
    const total = body.total.area_weighted.indicators.find((i: any) => i.indicator_id === "C_N")
    expect(total.score).toBeCloseTo(0.75)
    expect(body.total.minimum.aggregations).toEqual([{ aggregation_id: "S_BLN", score: 0.4 }])
  })

  it("keeps other farms when the indicators of one farm fail, without details", async () => {
    const getFarmIndicators = vi
      .fn()
      .mockResolvedValueOnce(farmIndicators("farm-a", [fieldScore("f1", 1, 0.5)]))
      .mockRejectedValueOnce(new Error("Request to NMI API failed: secret"))
    const app = makeApp({ getFarmIndicators } as any)
    const res = await app.request("/farm-groups/g-1/indicators?year=2026", { headers })
    const body = await res.json()
    expect(body.farms[1]).toEqual({
      b_id_farm: "farm-b",
      area_weighted: null,
      minimum: null,
      error: "The result of this farm could not be calculated.",
    })
    expect(JSON.stringify(body)).not.toContain("secret")
  })

  it("returns the measures per farm and for the whole group", async () => {
    const getFarmMeasureSummary = vi
      .fn()
      .mockResolvedValueOnce(measureSummary("farm-a", 2, "2026-03-01"))
      .mockResolvedValueOnce(measureSummary("farm-b", 1, "2026-02-01"))
    const app = makeApp({ getFarmMeasureSummary } as any)
    const res = await app.request("/farm-groups/g-1/measures?year=2026", { headers })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.farms[0]).toMatchObject({
      b_id_farm: "farm-a",
      eligible_fields: ["farm-a-f1"],
      measures: [{ m_id: "m-1", m_start: "2026-03-01", field_count: 2 }],
    })
    expect(body.total).toMatchObject({
      eligible_field_count: 2,
      measures: [
        { m_id: "m-1", b_id_farms: ["farm-a", "farm-b"], field_count: 3, m_start: "2026-02-01" },
      ],
      main_cultivations: [{ b_lu_catalogue: "nl_265", b_area: 8 }],
    })
  })

  it("returns 403 without access to the group", async () => {
    const app = makeApp({
      getFarmGroup: vi.fn().mockRejectedValue(new Error("Permission denied")),
    })
    const res = await app.request("/farm-groups/g-1/measures?year=2026", { headers })
    expect(res.status).toBe(403)
  })

  it("returns 400 without a year", async () => {
    const app = makeApp()
    const res = await app.request("/farm-groups/g-1/measures", { headers })
    expect(res.status).toBe(400)
  })

  it("returns 401 without an API key", async () => {
    const app = makeApp()
    const res = await app.request("/farm-groups/g-1/measures?year=2026")
    expect(res.status).toBe(401)
  })
})

describe("organization aggregations", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    validKey()
  })

  it("calculates for all farms of the organization, as the organization", async () => {
    const getFarmIdsOfOrganization = vi.fn().mockResolvedValue(["farm-a", "farm-c"])
    const getNitrogenBalanceForFarms = vi
      .fn()
      .mockResolvedValue({ total: { balance: 5 }, farms: [] })
    const app = makeApp({ getFarmIdsOfOrganization, getNitrogenBalanceForFarms } as any)
    const res = await app.request("/organizations/org-1/calculations/nitrogen-balance?year=2026", {
      headers,
    })
    expect(res.status).toBe(200)
    expect(getFarmIdsOfOrganization).toHaveBeenCalledWith(mockFdm, "user-1", "org-1")
    // The membership is checked; the calculation runs as the organization, like the web app.
    expect(getNitrogenBalanceForFarms.mock.calls[0]?.[1]).toBe("org-1")
    expect(getNitrogenBalanceForFarms.mock.calls[0]?.[2]).toEqual(["farm-a", "farm-c"])
  })

  it("narrows to the requested farms of the organization", async () => {
    const getFarmMeasureSummary = vi
      .fn()
      .mockResolvedValue(measureSummary("farm-c", 1, "2026-01-01"))
    const app = makeApp({ getFarmMeasureSummary } as any)
    const res = await app.request("/organizations/org-1/measures?year=2026&b_id_farm=farm-c", {
      headers,
    })
    expect(res.status).toBe(200)
    expect(getFarmMeasureSummary).toHaveBeenCalledTimes(1)
    expect(getFarmMeasureSummary.mock.calls[0]?.[2]).toBe("farm-c")
  })

  it("returns 422 for a farm the organization has no access to", async () => {
    const app = makeApp({ getFarmMeasureSummary: vi.fn() } as any)
    const res = await app.request("/organizations/org-1/measures?year=2026&b_id_farm=farm-x", {
      headers,
    })
    expect(res.status).toBe(422)
  })

  it("returns 403 for a user who is not a member", async () => {
    const app = makeApp({
      getFarmIdsOfOrganization: vi.fn().mockRejectedValue(
        new Error("Exception for getFarmIdsOfOrganization", {
          cause: new Error("Principal does not have permission to perform this action"),
        }),
      ),
    })
    const res = await app.request("/organizations/org-1/indicators?year=2026", { headers })
    expect(res.status).toBe(403)
  })
})
