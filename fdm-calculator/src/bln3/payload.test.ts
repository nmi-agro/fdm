import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { requestBln3MeasureAdvice } from "./advice"
import { requestBln3MeasureApplicability } from "./applicability"
import { requestBln3Score } from "./index"
import { BLN3_MEASURE_FIELDS, BLN3_SCORE_FIELDS, pickBln3Payload } from "./payload"

const INTERNAL_FIELDS = ["b_bufferstrip", "b_lu_croprotation", "b_lu_catalogue", "isExcluded"]

const internalInputs = {
  b_bufferstrip: false,
  b_lu_croprotation: "maize",
  b_lu_catalogue: "nl_259",
  isExcluded: false,
}

const scoreInputs = {
  nmiApiKey: "mock-api-key",
  a_lat: 51.613,
  a_lon: 5.2,
  b_soiltype_agr: "dekzand" as const,
  a_som_loi: 4.2,
  cultivations: [{ b_lu_brp: 266, b_lu_year: 2025 }],
  measures: [{ measure_id: "BM3", year: 2025 }],
  ...internalInputs,
}

const measureInputs = {
  nmiApiKey: "mock-api-key",
  a_lat: 51.613,
  a_lon: 5.2,
  b_year: 2026,
  b_gwl_zcrit: 120,
  b_drain: true,
  p_app_method: ["broadcasting"],
  a_som_loi: 4.2,
  cultivations: [{ b_lu_brp: 266, b_lu_year: 2025 }],
  ...internalInputs,
}

describe("pickBln3Payload", () => {
  it("keeps only whitelisted score fields and drops internal fields and the API key", () => {
    const payload = pickBln3Payload("score", scoreInputs)
    expect(Object.keys(payload)).toEqual([
      "a_lat",
      "a_lon",
      "cultivations",
      "b_soiltype_agr",
      "a_som_loi",
      "measures",
    ])
  })

  it("keeps only whitelisted measure fields and never sends measures", () => {
    const payload = pickBln3Payload("applicability", {
      ...measureInputs,
      measures: [{ measure_id: "BM3", year: 2025 }],
    })
    expect(Object.keys(payload)).toEqual([
      "a_lat",
      "a_lon",
      "b_year",
      "cultivations",
      "b_gwl_zcrit",
      "b_drain",
      "p_app_method",
      "a_som_loi",
    ])
  })

  it("omits undefined values", () => {
    expect(pickBln3Payload("advice", { a_lat: 1, a_lon: 2, b_year: undefined })).toEqual({
      a_lat: 1,
      a_lon: 2,
    })
  })

  it("never whitelists internal-only fields", () => {
    for (const field of INTERNAL_FIELDS) {
      expect(BLN3_SCORE_FIELDS).not.toContain(field)
      expect(BLN3_MEASURE_FIELDS).not.toContain(field)
    }
  })
})

describe("BLN3 request bodies", () => {
  beforeAll(() => {
    vi.stubGlobal("fetch", vi.fn())
  })

  afterEach(() => {
    vi.mocked(fetch).mockClear()
  })

  afterAll(() => {
    vi.restoreAllMocks()
  })

  const sentBody = () => JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string)

  it("score sends exactly the whitelisted keys", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, status: 200, data: { indicator: [] } }),
    } as Response)
    await requestBln3Score(scoreInputs)
    expect(Object.keys(sentBody())).toEqual([
      "a_lat",
      "a_lon",
      "cultivations",
      "b_soiltype_agr",
      "a_som_loi",
      "measures",
    ])
  })

  it("applicability sends exactly the whitelisted keys", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, status: 200, data: { applicability: [] } }),
    } as Response)
    await requestBln3MeasureApplicability(measureInputs)
    const body = sentBody()
    expect(Object.keys(body)).toEqual([
      "a_lat",
      "a_lon",
      "b_year",
      "cultivations",
      "b_gwl_zcrit",
      "b_drain",
      "p_app_method",
      "a_som_loi",
    ])
    for (const field of INTERNAL_FIELDS) expect(body).not.toHaveProperty(field)
  })

  it("advice sends exactly the whitelisted keys", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, status: 200, data: { indicator_advice: [] } }),
    } as Response)
    await requestBln3MeasureAdvice(measureInputs)
    const body = sentBody()
    expect(Object.keys(body)).toEqual([
      "a_lat",
      "a_lon",
      "b_year",
      "cultivations",
      "b_gwl_zcrit",
      "b_drain",
      "p_app_method",
      "a_som_loi",
    ])
    for (const field of INTERNAL_FIELDS) expect(body).not.toHaveProperty(field)
  })
})
