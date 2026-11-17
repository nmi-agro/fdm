/**
 * @packageDocumentation
 * @module mineralization/weather
 *
 * Weather forecast for a location (`GET /regras/v3/forecast/weather` of the NMI API).
 */

import { withCalculationCache } from "@nmi-agro/fdm-core"
import { z } from "zod"
import { weatherClient } from "../nmi/client"
import pkg from "../package"
import { NmiApiError } from "./errors"

const WEATHER_URL = "https://api.nmi-agro.nl/regras/v3/forecast/weather"

/** Weather forecast for one day. */
export interface WeatherForecastDay {
  /** Calendar date (`YYYY-MM-DD`). */
  date: string
  /** Minimum temperature at 2 m (°C). */
  w_temp_min_day: number
  /** Maximum temperature at 2 m (°C). */
  w_temp_max_day: number
  /** Mean temperature at 2 m (°C). */
  w_temp_mean_day: number
  /** Precipitation (mm). */
  w_prec_sum_day: number
  /** Reference evapotranspiration (mm). */
  w_et_ref_day: number
  /** Weather icon number (1–17). */
  w_icon: number
}

/** Weather forecast for the coming days. */
export interface WeatherForecast {
  /** Forecast per day, starting at the requested date. */
  days: WeatherForecastDay[]
  /** Short Dutch descriptions of the expected weather. */
  notifications: string[]
}

/** Input of {@link getWeatherForecast}. */
export interface WeatherForecastInput {
  /** NMI API key; redacted before the input is used as cache key. */
  nmiApiKey: string
  /** Latitude (WGS84). */
  a_lat: number
  /** Longitude (WGS84). */
  a_lon: number
  /** First day of the forecast (`YYYY-MM-DD`); today or earlier. */
  date: string
}

const weatherResponseDataSchema = z.object({
  forecast: z.array(
    z.object({
      date: z.string(),
      w_temp_min_day: z.number(),
      w_temp_max_day: z.number(),
      w_temp_mean_day: z.number(),
      w_prec_sum_day: z.number(),
      w_et_ref_day: z.number(),
      w_icon: z.number(),
    }),
  ),
  notifications: z.array(z.string()).catch([]).default([]),
})

/**
 * Rounds a coordinate to two decimals (about 1 km), so nearby fields share a cached forecast.
 *
 * @param value - Latitude or longitude.
 * @returns The rounded coordinate.
 */
export function roundCoordinate(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Requests the weather forecast (up to 14 days) for a location.
 *
 * This is the uncached call; use {@link getWeatherForecast} in applications.
 *
 * @param input - API key, location and first day of the forecast.
 * @returns The forecast per day and the weather notifications.
 * @throws {@link NmiApiError} when the API responds with an error status.
 * @throws `Error` when the response cannot be read.
 */
export async function requestWeatherForecast(
  input: WeatherForecastInput,
): Promise<WeatherForecast> {
  const params = new URLSearchParams({
    a_lat: String(input.a_lat),
    a_lon: String(input.a_lon),
    date: input.date,
  })
  const response = await weatherClient.request(`${WEATHER_URL}?${params.toString()}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${input.nmiApiKey}`, lang: "nl" },
  })

  if (!response.ok) {
    throw new NmiApiError(
      response.status,
      response.status === 429
        ? "De NMI API is druk, probeer het later opnieuw."
        : "De weersverwachting is tijdelijk niet beschikbaar.",
    )
  }

  const json = (await response.json().catch(() => null)) as { data?: unknown } | null
  const parsed = weatherResponseDataSchema.safeParse(json?.data)
  if (!parsed.success) {
    throw new Error("Ongeldige weersverwachting ontvangen")
  }
  return { days: parsed.data.forecast, notifications: parsed.data.notifications }
}

/**
 * Cached version of {@link requestWeatherForecast}.
 *
 * The cache key consists of the location and the date, so a forecast is requested at most once
 * per location per day. Round the coordinates with {@link roundCoordinate} to share forecasts
 * between nearby fields.
 *
 * **Signature:** `(fdm: FdmType, input: WeatherForecastInput) => Promise<WeatherForecast>`
 */
export const getWeatherForecast = withCalculationCache(
  requestWeatherForecast,
  "requestWeatherForecast",
  pkg.calculatorVersion,
  ["nmiApiKey"],
)
