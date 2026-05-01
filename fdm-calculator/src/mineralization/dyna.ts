/**
 * @packageDocumentation
 * @module mineralization/dyna
 *
 * DYNA calculation via the NMI API.
 *
 * Provides two exports:
 * - {@link requestDyna} — the raw, uncached API call function
 * - {@link getDyna} — the DB-backed cached version (use this in production)
 *
 * The DYNA model simulates daily nitrogen dynamics through the growing season,
 * combining soil N supply, crop uptake, fertilizer releases, and leaching into
 * a continuous curve. It returns:
 * - A daily time series ({@link DynaDailyPoint}[]) covering the entire rotation period
 * - A season-total nitrogen balance ({@link DynaNitrogenBalance})
 * - Optional fertilizer dose + timing advice ({@link DynaFertilizerAdvice})
 * - Optional optimal harvest date
 *
 * @example
 * ```typescript
 * import { getDyna } from "@nmi-agro/fdm-calculator"
 *
 * const result = await getDyna(fdm, {
 *   b_id: "field_abc",
 *   nmiApiKey: process.env.NMI_API_KEY,
 *   requestBody: buildDynaRequest(field, soilData, cultivations, fertilizers, "arable", timeframe, cropProperties),
 * })
 * ```
 */

import { withCalculationCache } from "@nmi-agro/fdm-core"
import { z } from "zod"
import pkg from "../package"
import { NmiApiError } from "./errors"
import { dynaResponseSchema } from "./schemas"
import type { DynaComputeInput, DynaResult } from "./types"

// ─── API call ─────────────────────────────────────────────────────────────────

/**
 * Calls `POST /bemestingsplan/dyna` with the pre-built request body and
 * returns the parsed DYNA simulation result as a {@link DynaResult}.
 *
 * This is the **uncached** version. In most cases you should use {@link getDyna}
 * which adds DB-backed caching via `withCalculationCache`.
 *
 * The response body uses `snake_case` field names which are transformed to
 * `camelCase` by {@link dynaResponseDataSchema} during validation.
 *
 * **Error handling:**
 * | HTTP status | Thrown error |
 * |-------------|--------------|
 * | 400 | `NmiApiError(400, "Er is een fout opgetreden bij de DYNA-berekening. ...")` — e.g. duplicate year or missing `b_lu` |
 * | 422 | `NmiApiError(422, "Onvoldoende gegevens voor DYNA-berekening.")` |
 * | 503 | `NmiApiError(503, "NMI API is tijdelijk niet beschikbaar.")` |
 * | other 4xx/5xx | `NmiApiError(status, "Er is een fout opgetreden...")` |
 * | invalid JSON | `Error("Ongeldig DYNA-antwoord van NMI API: ...")` |
 *
 * @param input - Pre-assembled input bundle: field id, API key, and the
 *   fully-formed DYNA request body (built by {@link buildDynaRequest}).
 * @returns A {@link DynaResult} with daily simulation data, nitrogen balance,
 *   and optional recommendations.
 * @throws {@link NmiApiError} on API or HTTP errors.
 * @throws `Error` if the response body fails Zod validation.
 */
export async function requestDyna(
    input: DynaComputeInput,
): Promise<DynaResult> {
    const { b_id, nmiApiKey, requestBody } = input

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 60000) // 60s timeout for DYNA

    try {
        const response = await fetch(
            "https://api.nmi-agro.nl/bemestingsplan/dyna",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${nmiApiKey}`,
                    "NMI-API-Version": "v1",
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal,
            },
        )

        if (!response.ok) {
            const errorText = await response.text()
            if (response.status === 422) {
                throw new NmiApiError(
                    422,
                    `Onvoldoende gegevens voor DYNA-berekening. ${errorText}`,
                )
            }
            if (response.status === 503) {
                throw new NmiApiError(
                    503,
                    "NMI API is tijdelijk niet beschikbaar.",
                )
            }
            throw new NmiApiError(
                response.status,
                `Er is een fout opgetreden bij de DYNA-berekening. ${errorText}`,
            )
        }

        let json: unknown
        try {
            json = await response.json()
        } catch (_err) {
            throw new Error(
                "Ongeldig DYNA-antwoord van NMI API: Geen geldige JSON",
            )
        }

        const parsed = dynaResponseSchema.safeParse(json)
        if (!parsed.success) {
            throw new Error(
                `Ongeldig DYNA-antwoord van NMI API: ${JSON.stringify(z.treeifyError(parsed.error))}`,
            )
        }

        return { b_id, ...parsed.data.data }
    } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
            throw new NmiApiError(
                408,
                "De aanvraag naar de NMI API is verlopen (timeout).",
            )
        }
        throw err
    } finally {
        clearTimeout(timeout)
    }
}

// ─── Cached version ───────────────────────────────────────────────────────────

/**
 * DB-backed cached version of {@link requestDyna}.
 *
 * Uses `withCalculationCache` from `@nmi-agro/fdm-core` to persist results in
 * the FDM database. The cache key is derived from a hash of the input (excluding
 * `nmiApiKey` which is redacted). The cache is automatically invalidated when
 * the request body changes (e.g. when soil data, cultivations, or fertilizer
 * applications are updated) or when the package version changes.
 *
 * Because the DYNA model simulates the full rotation, a single cached result
 * covers all years in the rotation. The caller should filter the returned
 * `calculationDyna` array to the target calendar year before displaying.
 *
 * **Signature:** `(fdm: FdmType, input: DynaComputeInput) => Promise<DynaResult>`
 *
 * Cache parameters:
 * - Function name: `"requestDyna"`
 * - Version: `pkg.calculatorVersion` (invalidates on package upgrades)
 * - Sensitive keys: `["nmiApiKey"]` (redacted from cache key hash)
 *
 * @example
 * ```typescript
 * import { getDyna } from "@nmi-agro/fdm-calculator"
 *
 * const result = await getDyna(fdm, {
 *   b_id: "field_abc",
 *   nmiApiKey: env.NMI_API_KEY,
 *   requestBody: buildDynaRequest(
 *     field, soilData, cultivations, fertilizers,
 *     "arable", timeframe, cropProperties
 *   ),
 * })
 * // Filter to current year before rendering:
 * const yearData = result.calculationDyna.filter(
 *   d => new Date(d.b_date_calculation).getFullYear() === 2026
 * )
 * ```
 */
export const getDyna = withCalculationCache(
    requestDyna,
    "requestDyna",
    pkg.calculatorVersion,
    ["nmiApiKey"],
)
