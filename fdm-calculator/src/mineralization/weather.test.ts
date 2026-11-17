import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { NmiApiError } from "./errors"
import { requestWeatherForecast, roundCoordinate } from "./weather"

const input = { nmiApiKey: "mock-api-key", a_lat: 52, a_lon: 5.6, date: "2026-06-01" }

function day(date: string, prec: number) {
  return {
    date,
    w_temp_min_day: 9.5,
    w_temp_mean_day: 11.4,
    w_temp_max_day: 14.1,
    w_prec_sum_day: prec,
    w_ghi_sum_day: 779,
    w_et_ref_day: 1.3,
    w_icon: 16,
    w_tsum: 1200,
  }
}

describe("requestWeatherForecast", () => {
  beforeAll(() => {
    vi.stubGlobal("fetch", vi.fn())
  })

  afterEach(() => {
    vi.mocked(fetch).mockReset()
  })

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  it("requests the forecast for the location and date", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ data: { forecast: [day("2026-06-01", 0)], notifications: [] } }),
    )

    await requestWeatherForecast(input)

    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe(
      "https://api.nmi-agro.nl/regras/v3/forecast/weather?a_lat=52&a_lon=5.6&date=2026-06-01",
    )
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer mock-api-key")
    expect((init?.headers as Record<string, string>).lang).toBe("nl")
  })

  it("parses the forecast days and notifications", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({
        data: {
          forecast: Array.from({ length: 14 }, (_, i) =>
            day(`2026-06-${String(i + 1).padStart(2, "0")}`, i),
          ),
          notifications: ["Er wordt vrij veel neerslag verwacht de komende 10 dagen."],
        },
      }),
    )

    const forecast = await requestWeatherForecast(input)

    expect(forecast.days).toHaveLength(14)
    expect(forecast.days[2]).toEqual({
      date: "2026-06-03",
      w_temp_min_day: 9.5,
      w_temp_mean_day: 11.4,
      w_temp_max_day: 14.1,
      w_prec_sum_day: 2,
      w_et_ref_day: 1.3,
      w_icon: 16,
    })
    expect(forecast.notifications).toEqual([
      "Er wordt vrij veel neerslag verwacht de komende 10 dagen.",
    ])
  })

  it("throws NmiApiError 429 when the API is busy", async () => {
    vi.mocked(fetch).mockImplementation(async () =>
      Response.json({ message: "busy" }, { status: 429, headers: { "retry-after": "0" } }),
    )

    const error = await requestWeatherForecast(input).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(NmiApiError)
    expect((error as NmiApiError).status).toBe(429)
  })

  it("throws NmiApiError with a generic message for other errors", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ message: "forbidden" }, { status: 403 }))

    const error = await requestWeatherForecast(input).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(NmiApiError)
    expect((error as NmiApiError).status).toBe(403)
    expect((error as NmiApiError).message).toBe(
      "De weersverwachting is tijdelijk niet beschikbaar.",
    )
  })

  it("throws when the response is not a forecast", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("not json", { status: 200 }))

    await expect(requestWeatherForecast(input)).rejects.toThrow(
      "Ongeldige weersverwachting ontvangen",
    )
  })
})

describe("roundCoordinate", () => {
  it("rounds to two decimals", () => {
    expect(roundCoordinate(5.61234)).toBe(5.61)
    expect(roundCoordinate(52.0049)).toBe(52)
  })
})
