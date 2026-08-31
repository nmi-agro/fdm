import { withCalculationCache } from "@nmi-agro/fdm-core"
import type {
  Bln3MeasureAdviceInputs,
  Bln3MeasureAdviceResponse,
  Bln3MeasureAdviceResult,
} from "./types"
import pkg from "../package"

/**
 * Requests BLN3 measure advice from the NMI API for a single field.
 *
 * Calls `POST /maatwerk/bln3/measure/advice` with the provided field data and
 * returns, per indicator, a list of candidate measures ranked by their
 * predicted impact on that indicator. Each measure ID is prefixed with
 * "bln_" (e.g. "bln_BM226") to match FDM catalogue conventions.
 *
 * This endpoint is marked experimental by NMI: the interface may change
 * without the usual advance notice given for stable endpoints.
 *
 * Note: the response is not guaranteed to already exclude measures that are
 * inapplicable to the field or already taken. Callers must always
 * cross-reference results against a fresh `measure/applicability` call (the
 * definitive source of truth for applicability) before displaying advice.
 *
 * @param inputs - Field data and NMI API key. `a_lat`, `a_lon`, `b_year`, and `nmiApiKey` are required.
 * @returns A promise resolving to a `Bln3MeasureAdviceResult` containing `indicator_advice`.
 * @throws If the NMI API key is not provided or the API request fails.
 */
export async function requestBln3MeasureAdvice(
  inputs: Bln3MeasureAdviceInputs,
): Promise<Bln3MeasureAdviceResult> {
  const { nmiApiKey, ...fieldData } = inputs

  if (!nmiApiKey) {
    throw new Error("NMI API key not provided")
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000) // 30s timeout

  try {
    const response = await fetch("https://api.nmi-agro.nl/maatwerk/bln3/measure/advice", {
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
        `BLN3 measure advice request failed with status ${response.status}: ${response.statusText} - ${errorText}`,
      )
    }

    const result: Bln3MeasureAdviceResponse = await response.json()
    if (!result.success) {
      throw new Error(
        `BLN3 measure advice API returned failure (status ${result.status}): ${result.message ?? "Unknown error"}`,
      )
    }

    if (!result.data || !Array.isArray(result.data.indicator_advice)) {
      throw new Error(
        "BLN3 measure advice API returned a malformed payload (missing data or indicator_advice array)",
      )
    }

    for (const entry of result.data.indicator_advice) {
      if (
        !entry ||
        typeof entry.indicator !== "string" ||
        entry.indicator.trim().length === 0 ||
        !Array.isArray(entry.measures)
      ) {
        throw new Error(
          "BLN3 measure advice API returned a malformed payload (invalid item in indicator_advice array)",
        )
      }
      for (const measure of entry.measures) {
        if (
          !measure ||
          typeof measure.m_id !== "string" ||
          measure.m_id.trim().length === 0 ||
          typeof measure.measure_impact !== "number"
        ) {
          throw new Error(
            "BLN3 measure advice API returned a malformed payload (invalid measure in indicator_advice array)",
          )
        }
      }
    }

    // Map m_id to "bln_" prefixed format to match FDM CatalogueMeasureItem.m_id convention
    return {
      indicator_advice: result.data.indicator_advice.map((entry) => ({
        indicator: entry.indicator,
        measures: entry.measures.map((measure) => ({
          ...measure,
          m_id: measure.m_id.startsWith("bln_") ? measure.m_id : `bln_${measure.m_id}`,
        })),
      })),
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(
        "BLN3 measure advice request timed out (30s). The NMI API did not respond in time.",
      )
    }
    throw err
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Cached version of `requestBln3MeasureAdvice`.
 *
 * Uses `withCalculationCache` to store and retrieve results from the
 * `fdm-calculator.calculation_cache` table. The cache key is a SHA-256 hash
 * of the function name, calculator version, and sanitized inputs (API key
 * redacted). Bumping `calculatorVersion` in `package.ts` invalidates all
 * existing cache entries.
 */
export const getBln3MeasureAdvice = withCalculationCache(
  requestBln3MeasureAdvice,
  "requestBln3MeasureAdvice",
  pkg.calculatorVersion,
  ["nmiApiKey"],
)
