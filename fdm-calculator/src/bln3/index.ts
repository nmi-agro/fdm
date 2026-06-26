import { withCalculationCache } from "@nmi-agro/fdm-core"
import type { Bln3Score, Bln3ScoreInputs, Bln3ScoreResponse } from "./types"
import pkg from "../package"

export { collectInputForBln3Score } from "./input"

/**
 * Requests a BLN3 score from the NMI API for a single field.
 *
 * Calls `POST /maatwerk/bln3/score/field` with the provided field data and
 * returns per-indicator status, target, index, impact, and score values.
 *
 * @param inputs - Field data and NMI API key. Only `a_lat`, `a_lon`, and
 *   `nmiApiKey` are required; all other fields improve calculation quality.
 * @returns A promise resolving to a `Bln3Score` with `indicators` and
 *   optional `aggregations`.
 * @throws If the NMI API key is not provided or the API request fails.
 */
export async function requestBln3Score(inputs: Bln3ScoreInputs): Promise<Bln3Score> {
  const { nmiApiKey, ...fieldData } = inputs

  if (!nmiApiKey) {
    throw new Error("NMI API key not provided")
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000) // 30s timeout

  try {
    const response = await fetch("https://api.nmi-agro.nl/maatwerk/bln3/score/field", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${nmiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(fieldData),
      signal: controller.signal,
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => "")
      throw new Error(
        `BLN3 score request failed with status ${response.status}: ${response.statusText} - ${errorText}`,
      )
    }

    const result: Bln3ScoreResponse = await response.json()
    if (!result.success) {
      throw new Error(
        `BLN3 score API returned failure (status ${result.status}): ${result.message ?? "Unknown error"}`,
      )
    }

    if (!result.data || !Array.isArray(result.data.indicator)) {
      throw new Error(
        "BLN3 score API returned a malformed payload (missing data or indicator array)",
      )
    }

    // Map the API's "indicator" (singular) to "indicators" (plural) for ergonomics
    return {
      indicators: result.data.indicator,
      aggregations: result.data.aggregations,
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("BLN3 score request timed out (30s). The NMI API did not respond in time.")
    }
    throw err
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Cached version of `requestBln3Score`.
 *
 * Uses `withCalculationCache` to store and retrieve results from the
 * `fdm-calculator.calculation_cache` table. The cache key is a SHA-256 hash
 * of the function name, calculator version, and sanitized inputs (API key
 * redacted). Bumping `calculatorVersion` in `package.ts` invalidates all
 * existing cache entries.
 */
export const getBln3Score = withCalculationCache(
  requestBln3Score,
  "requestBln3Score",
  pkg.calculatorVersion,
  ["nmiApiKey"],
)
