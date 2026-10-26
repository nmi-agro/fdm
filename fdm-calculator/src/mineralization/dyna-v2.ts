/**
 * @packageDocumentation
 * @module mineralization/dyna-v2
 *
 * Nitrogen simulation with Dyna v2 (`POST /bemestingsplan/dyna/v2` of the NMI API).
 */

import { withCalculationCache } from "@nmi-agro/fdm-core"
import type { DynaV2ComputeInput, DynaV2Result } from "./types"
import { dynaClient } from "../nmi/client"
import pkg from "../package"
import { NmiApiError } from "./errors"
import { DYNA_V2_EMPTY_SERIES_MESSAGE, dynaV2ResponseDataSchema } from "./schemas"

const DYNA_V2_URL = "https://api.nmi-agro.nl/bemestingsplan/dyna/v2"

/**
 * Reads the `message` of an NMI API error envelope, if any.
 *
 * @param response - Response with a non-2xx status.
 * @returns The message, or an empty string.
 */
async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: unknown }
    return typeof body.message === "string" ? body.message : ""
  } catch {
    return ""
  }
}

/**
 * Converts a failed Dyna response into an {@link NmiApiError} with a Dutch message for users.
 *
 * @param response - Response with a non-2xx status.
 * @returns The error to throw.
 */
async function toNmiApiError(response: Response): Promise<NmiApiError> {
  const status = response.status
  if (status === 400) {
    const message = await readErrorMessage(response)
    return new NmiApiError(
      400,
      message
        ? `Dyna kon niet rekenen met deze gegevens: ${message}`
        : "Dyna kon niet rekenen met deze gegevens.",
    )
  }
  if (status === 401 || status === 403) {
    return new NmiApiError(status, "Geen toegang tot de NMI API.")
  }
  if (status === 429) {
    return new NmiApiError(429, "De NMI API is druk, probeer het later opnieuw.")
  }
  if (status >= 500) {
    return new NmiApiError(status, "De NMI API is tijdelijk niet beschikbaar.")
  }
  return new NmiApiError(status, "Er is een fout opgetreden bij de Dyna-berekening.")
}

/**
 * Runs a Dyna v2 nitrogen simulation for one field.
 *
 * This is the uncached call; use {@link getDynaV2} in applications.
 *
 * Behaviour of the endpoint that callers should be aware of:
 * - The simulation is daily and runs from the earliest date in the request (cultivation start or
 *   fertilizer application) to the end of the last cultivation.
 * - `b_nw`, `b_n_uptake` and `b_no3_leach` are cumulative since the start of the simulation.
 * - The crop keeps taking up nitrogen until `b_lu_end`, so for crops that are harvested once the
 *   end of the cultivation should be the harvest date.
 *
 * @param input - API key, request body and calculation date.
 * @returns The daily simulation and the workable nitrogen balance.
 * @throws {@link NmiApiError} when the API responds with an error status or times out.
 * @throws `Error` when the response cannot be read or contains no simulation.
 */
export async function requestDynaV2(input: DynaV2ComputeInput): Promise<DynaV2Result> {
  let response: Response
  try {
    response = await dynaClient.request(DYNA_V2_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${input.nmiApiKey}`,
      },
      body: JSON.stringify(input.request),
    })
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new NmiApiError(408, "De berekening duurde te lang, probeer het later opnieuw.")
    }
    throw err
  }

  if (!response.ok) {
    throw await toNmiApiError(response)
  }

  let json: { data?: unknown }
  try {
    json = (await response.json()) as { data?: unknown }
  } catch {
    throw new Error("Ongeldig antwoord van Dyna ontvangen")
  }

  const parsed = dynaV2ResponseDataSchema.safeParse(json.data)
  if (!parsed.success) {
    const emptySeries = parsed.error.issues.some(
      (issue) => issue.message === DYNA_V2_EMPTY_SERIES_MESSAGE,
    )
    throw new Error(
      emptySeries ? DYNA_V2_EMPTY_SERIES_MESSAGE : "Ongeldig antwoord van Dyna ontvangen",
    )
  }
  return parsed.data
}

/**
 * Cached version of {@link requestDynaV2}.
 *
 * Results are stored in the calculation cache of fdm-core. The cache key is derived from the
 * request body and the calculation date (the API key is redacted), so a result is reused within
 * the same day as long as the input does not change. Errors are not cached.
 *
 * **Signature:** `(fdm: FdmType, input: DynaV2ComputeInput) => Promise<DynaV2Result>`
 */
export const getDynaV2 = withCalculationCache(
  requestDynaV2,
  "requestDynaV2",
  pkg.calculatorVersion,
  ["nmiApiKey"],
)
