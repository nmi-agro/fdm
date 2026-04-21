/**
 * @packageDocumentation
 * @module mineralization/nsupply
 *
 * N supply (nitrogen mineralization) curve calculation via the NMI API.
 *
 * Provides two exports:
 * - {@link requestNSupply} — the raw, uncached API call function
 * - {@link getNSupply} — the DB-backed cached version (use this in production)
 *
 * @example
 * ```typescript
 * import { getNSupply } from "@nmi-agro/fdm-calculator"
 *
 * const result = await getNSupply(fdm, {
 *   b_id: "field_abc",
 *   b_name: "Perceel Noord",
 *   nmiApiKey: process.env.NMI_API_KEY,
 *   requestBody: buildNSupplyRequest(field, soilData, cultivations, "minip", timeframe),
 *   method: "minip",
 *   completeness,
 * })
 * ```
 */

import { withCalculationCache } from "@nmi-agro/fdm-core"
import { z } from "zod"
import { NmiApiError } from "./errors"
import { nsupplyResponseSchema } from "./schemas"
import type { NSupplyComputeInput, NSupplyResult } from "./types"
import pkg from "../package"

// ─── API call ─────────────────────────────────────────────────────────────────

/**
 * Calls `POST /bemestingsplan/nsupply` with the pre-built request body and
 * returns the parsed N supply curve as an {@link NSupplyResult}.
 *
 * This is the **uncached** version. In most cases you should use {@link getNSupply}
 * which adds DB-backed caching via `withCalculationCache`.
 *
 * **Error handling:**
 * | HTTP status | Thrown error |
 * |-------------|--------------|
 * | 401 / 403 | `NmiApiError(status, "API-sleutel niet geconfigureerd of verlopen.")` |
 * | 422 | `NmiApiError(422, "Onvoldoende bodemgegevens...")` |
 * | 503 | `NmiApiError(503, "NMI API is tijdelijk niet beschikbaar.")` |
 * | other 4xx/5xx | `NmiApiError(status, "Er is een fout opgetreden...")` |
 * | invalid JSON | `Error("Ongeldig antwoord van NMI API: ...")` |
 *
 * @param input - Pre-assembled input bundle including the request body,
 *   field metadata, chosen method, and data completeness assessment.
 * @returns A fully populated {@link NSupplyResult}.
 * @throws {@link NmiApiError} on API or HTTP errors.
 * @throws `Error` if the response body fails Zod validation.
 */
export async function requestNSupply(
    input: NSupplyComputeInput,
): Promise<NSupplyResult> {
    const { b_id, b_name, area, nmiApiKey, requestBody, method, completeness } =
        input

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000) // 30s timeout

    try {
        const response = await fetch(
            "https://api.nmi-agro.nl/bemestingsplan/nsupply",
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
                    `Onvoldoende bodemgegevens voor mineralisatieberekening. ${errorText}`,
                )
            }
            if (response.status === 503) {
                throw new NmiApiError(
                    503,
                    "NMI API is tijdelijk niet beschikbaar.",
                )
            }
            if (response.status === 401 || response.status === 403) {
                throw new NmiApiError(
                    response.status,
                    "NMI API-sleutel niet geconfigureerd of verlopen.",
                )
            }
            throw new NmiApiError(
                response.status,
                `Er is een fout opgetreden bij het berekenen van de mineralisatie. ${errorText}`,
            )
        }

        let json: unknown
        try {
            json = await response.json()
        } catch (err) {
            throw new Error("Ongeldig antwoord van NMI API: Geen geldige JSON")
        }

        const parsed = nsupplyResponseSchema.safeParse(json)
        if (!parsed.success) {
            throw new Error(
                `Ongeldig antwoord van NMI API: ${JSON.stringify(z.treeifyError(parsed.error))}`,
            )
        }

        return {
            b_id,
            b_name,
            area,
            method,
            data: parsed.data.data,
            totalAnnualN:
                parsed.data.data.length > 0
                    ? (parsed.data.data[parsed.data.data.length - 1]
                          ?.d_n_supply_actual ?? 0)
                    : 0,
            completeness,
        }
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
 * DB-backed cached version of {@link requestNSupply}.
 *
 * Uses `withCalculationCache` from `@nmi-agro/fdm-core` to persist results in
 * the FDM database. The cache key is derived from a hash of the input (excluding
 * `nmiApiKey` which is redacted). The cache is automatically invalidated when
 * the request body changes (e.g. soil data updated, different method selected)
 * or when the package version changes.
 *
 * **Signature:** `(fdm: FdmType, input: NSupplyComputeInput) => Promise<NSupplyResult>`
 *
 * Cache parameters:
 * - Function name: `"requestNSupply"`
 * - Version: `pkg.calculatorVersion` (invalidates on package upgrades)
 * - Sensitive keys: `["nmiApiKey"]` (redacted from cache key hash)
 *
 * @example
 * ```typescript
 * import { getNSupply } from "@nmi-agro/fdm-calculator"
 *
 * const result = await getNSupply(fdm, {
 *   b_id: "field_abc",
 *   b_name: "Perceel Noord",
 *   nmiApiKey: env.NMI_API_KEY,
 *   requestBody: buildNSupplyRequest(field, soilData, cultivations, "minip", timeframe),
 *   method: "minip",
 *   completeness,
 * })
 * ```
 */
export const getNSupply = withCalculationCache(
    requestNSupply,
    "requestNSupply",
    pkg.calculatorVersion,
    ["nmiApiKey"],
)
