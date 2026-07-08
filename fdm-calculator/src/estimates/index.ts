/**
 * @packageDocumentation
 * @module estimates
 *
 * Soil parameter + BRP cultivation-history estimates via the NMI API.
 *
 * Provides two exports:
 * - {@link requestSoilParameterEstimates} — the raw, uncached API call function
 * - {@link getSoilParameterEstimates} — the DB-backed cached version (use this in production)
 *
 * Callers are responsible for resolving the field centroid coordinates before calling
 * either function. For persisted fields, use {@link collectInputForSoilParameterEstimates}
 * (see `./input`) to resolve the centroid via `getField`.
 *
 * @example
 * ```typescript
 * import { collectInputForSoilParameterEstimates, getSoilParameterEstimates } from "@nmi-agro/fdm-calculator"
 *
 * const input = await collectInputForSoilParameterEstimates(fdm, principal_id, b_id, nmiApiKey)
 * const estimates = await getSoilParameterEstimates(fdm, input)
 * ```
 */

import { withCalculationCache } from "@nmi-agro/fdm-core"
import { z } from "zod"
import type { SoilParameterEstimatesInput, SoilParameterEstimatesResponse } from "./types"
import pkg from "../package"
import { soilParameterEstimatesSchema } from "./schemas"

/**
 * Calls `GET /estimates` with the given centroid coordinates and returns the
 * parsed soil parameter + cultivation-history estimates.
 *
 * This is the **uncached** version. In most cases you should use {@link getSoilParameterEstimates}
 * which adds DB-backed caching via `withCalculationCache`.
 *
 * @param input - Centroid coordinates (`a_lat`/`a_lon`) and the NMI API key.
 * @throws {Error} If `nmiApiKey` is not provided, the NMI API request fails or times out, or the response fails validation.
 */
export async function requestSoilParameterEstimates({
  a_lat,
  a_lon,
  nmiApiKey,
}: SoilParameterEstimatesInput): Promise<SoilParameterEstimatesResponse> {
  if (!nmiApiKey) {
    throw new Error("Please provide a NMI API key")
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000) // 30s timeout

  let result: { data?: unknown }
  try {
    const responseApi = await fetch(
      `https://api.nmi-agro.nl/estimates?${new URLSearchParams({
        a_lat: a_lat.toString(),
        a_lon: a_lon.toString(),
      })}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${nmiApiKey}`,
        },
        signal: controller.signal,
      },
    )

    if (!responseApi.ok) {
      throw new Error("Request to NMI API failed")
    }

    result = await responseApi.json()
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("De aanvraag naar de NMI Estimates API is verlopen (timeout).")
    }
    throw err
  } finally {
    clearTimeout(timeout)
  }

  if (!result.data || typeof result.data !== "object") {
    throw new Error("Invalid response from NMI API: missing data")
  }

  const response = result.data as Record<string, unknown>
  response.a_source = "nl-other-nmi"
  response.a_depth_upper = 0
  response.a_depth_lower = undefined

  // Validate the response using the Zod schema
  const parsedResponse = soilParameterEstimatesSchema.safeParse(result.data)
  if (!parsedResponse.success) {
    console.error(
      "NMI API response validation failed:",
      JSON.stringify(z.treeifyError(parsedResponse.error), null, 2),
    )
    throw new Error(`Invalid response from NMI API: ${parsedResponse.error.message}`)
  }

  return response as unknown as SoilParameterEstimatesResponse
}

/**
 * Cached version of `requestSoilParameterEstimates`.
 * This function uses `withCalculationCache` to store and retrieve results,
 * improving performance for repeated calls with the same inputs.
 * The cache key is based on the inputs and the calculator version.
 */
export const getSoilParameterEstimates = withCalculationCache(
  requestSoilParameterEstimates,
  "requestSoilParameterEstimates",
  pkg.calculatorVersion,
  ["nmiApiKey"],
)
