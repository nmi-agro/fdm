import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import type { DynaV2ComputeInput } from "./types"
import { requestDynaV2 } from "./dyna-v2"
import { NmiApiError } from "./errors"

const input: DynaV2ComputeInput = {
  nmiApiKey: "mock-api-key",
  calculationDate: "2026-06-01",
  request: {
    field: { a_lat: 52, a_lon: 5.6 },
    cultivations: [
      { b_lu: "nl_2014", b_lu_id: "lu_1", b_lu_start: "2026-04-15", b_lu_end: "2026-09-20" },
    ],
    harvests: [{ b_lu_id: "lu_1", b_date_harvest: "2026-09-20" }],
  },
}

function okResponse(data: unknown) {
  return new Response(
    JSON.stringify({ request_id: "r", success: true, status: 200, message: null, data }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  )
}

function errorResponse(status: number, message: string) {
  return new Response(
    JSON.stringify({ request_id: "r", success: false, status, message, data: null }),
    { status, headers: { "Content-Type": "application/json", "retry-after": "0" } },
  )
}

const series = [
  { b_id: "field_1", b_date_calculation: "2026-04-15", b_nw: 50, b_n_uptake: 20, b_no3_leach: 1 },
  { b_id: "field_1", b_date_calculation: "2026-04-16", b_nw: 55, b_n_uptake: 22, b_no3_leach: 1 },
]

describe("requestDynaV2", () => {
  beforeAll(() => {
    vi.stubGlobal("fetch", vi.fn())
  })

  afterEach(() => {
    vi.mocked(fetch).mockReset()
  })

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  it("parses the series and the nitrogen balance", async () => {
    vi.mocked(fetch).mockResolvedValue(
      okResponse({
        calculation_dyna: series,
        nitrogen_balance: {
          b_id: "field_1",
          b_nw: 55,
          b_n_uptake: 22,
          b_n_fertilizer_mineral: 12,
          b_n_fertilizer_organic: 3,
          b_n_fertilizer_preceeding: 1,
          b_n_greenmanure: 4,
        },
      }),
    )

    const result = await requestDynaV2(input)

    expect(result.series).toHaveLength(2)
    expect(result.series[0]).toEqual({
      b_date_calculation: "2026-04-15",
      b_nw: 50,
      b_n_uptake: 20,
      b_no3_leach: 1,
      b_n_available: 30,
    })
    expect(result.balance.b_n_fertilizer_mineral).toBe(12)
    expect(result.balance.b_n_greenmanure).toBe(4)
  })

  it("defaults missing balance fields to 0", async () => {
    vi.mocked(fetch).mockResolvedValue(
      okResponse({
        calculation_dyna: series,
        nitrogen_balance: { b_id: "field_1", b_nw: 55, b_n_uptake: 22 },
      }),
    )

    const result = await requestDynaV2(input)

    expect(result.balance.b_n_greenmanure).toBe(0)
    expect(result.balance.b_n_fertilizer_preceeding).toBe(0)
    expect(result.balance.b_n_fertilizer_mineral).toBe(0)
  })

  it("sends bearer auth and the JSON body to /bemestingsplan/dyna/v2", async () => {
    vi.mocked(fetch).mockResolvedValue(okResponse({ calculation_dyna: series }))

    await requestDynaV2(input)

    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe("https://api.nmi-agro.nl/bemestingsplan/dyna/v2")
    expect(init?.method).toBe("POST")
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer mock-api-key")
    expect(JSON.parse(init?.body as string)).toEqual(input.request)
  })

  it("throws NmiApiError 429 asking to try again later", async () => {
    vi.mocked(fetch).mockImplementation(async () => errorResponse(429, "Too many requests"))

    const error = await requestDynaV2(input).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(NmiApiError)
    expect((error as NmiApiError).status).toBe(429)
    expect((error as NmiApiError).message).toContain("probeer het later opnieuw")
  })

  it("throws NmiApiError 400 with the API message", async () => {
    vi.mocked(fetch).mockResolvedValue(errorResponse(400, "b_date_harvest is missing"))

    const error = await requestDynaV2(input).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(NmiApiError)
    expect((error as NmiApiError).status).toBe(400)
    expect((error as NmiApiError).message).toContain("b_date_harvest is missing")
  })

  it("throws NmiApiError 500 when the API fails", async () => {
    vi.mocked(fetch).mockImplementation(async () => errorResponse(500, "error"))

    const error = await requestDynaV2(input).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(NmiApiError)
    expect((error as NmiApiError).status).toBe(500)
    expect((error as NmiApiError).message).toBe("De NMI API is tijdelijk niet beschikbaar.")
  })

  it("throws NmiApiError 400 without a message when the error body is not JSON", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("Bad Request", { status: 400 }))

    const error = await requestDynaV2(input).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(NmiApiError)
    expect((error as NmiApiError).status).toBe(400)
    expect((error as NmiApiError).message).toBe("Dyna kon niet rekenen met deze gegevens.")
  })

  it.each([401, 403])("throws NmiApiError %i when access is denied", async (status) => {
    vi.mocked(fetch).mockResolvedValue(errorResponse(status, "Unauthorized"))

    const error = await requestDynaV2(input).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(NmiApiError)
    expect((error as NmiApiError).status).toBe(status)
    expect((error as NmiApiError).message).toBe("Geen toegang tot de NMI API.")
  })

  it("throws a generic NmiApiError for other error statuses", async () => {
    vi.mocked(fetch).mockResolvedValue(errorResponse(404, "Not found"))

    const error = await requestDynaV2(input).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(NmiApiError)
    expect((error as NmiApiError).status).toBe(404)
    expect((error as NmiApiError).message).toBe("Er is een fout opgetreden bij de Dyna-berekening.")
  })

  it("throws NmiApiError 408 when the request times out", async () => {
    const timeout = new Error("Timed out")
    timeout.name = "TimeoutError"
    vi.mocked(fetch).mockRejectedValue(timeout)

    const error = await requestDynaV2(input).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(NmiApiError)
    expect((error as NmiApiError).status).toBe(408)
  })

  it("rethrows other network errors", async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError("fetch failed"))

    await expect(requestDynaV2(input)).rejects.toThrow("fetch failed")
  })

  it("throws when the response body is not JSON", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("<html>", { status: 200 }))

    await expect(requestDynaV2(input)).rejects.toThrow("Ongeldig antwoord van Dyna ontvangen")
  })

  it("throws when calculation_dyna is empty", async () => {
    vi.mocked(fetch).mockResolvedValue(okResponse({ calculation_dyna: [] }))

    await expect(requestDynaV2(input)).rejects.toThrow("Geen resultaten van Dyna ontvangen")
  })
})
