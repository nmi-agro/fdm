import { withCalculationCache } from "@nmi-agro/fdm-core"
import type {
  Bln3MeasureAdviceInputs,
  Bln3MeasureAdviceResponse,
  Bln3MeasureAdviceResult,
  Bln3MeasureApplicabilityInputs,
  Bln3MeasureApplicabilityResponse,
  Bln3MeasureApplicabilityResult,
  Bln3Score,
  Bln3ScoreInputs,
  Bln3ScoreResponse,
} from "./types"
import { bln3Client } from "../nmi/client"
import pkg from "../package"

/**
 * Requests a BLN3 score from the NMI API for a single field.
 *
 * Calls `POST /maatwerk/bln3/score/field` with the provided field data and
 * returns per-indicator status, target, index, impact, and score values.
 * If the field is excluded (buffer strip or nature crop rotation), returns
 * `null` immediately without calling the API.
 *
 * @param inputs - Field data and NMI API key. Only `a_lat`, `a_lon`, and
 *   `nmiApiKey` are required; all other fields improve calculation quality.
 * @returns A promise resolving to a `Bln3Score` with `indicators` and
 *   optional `aggregations`, or `null` if excluded.
 * @throws If the NMI API key is not provided or the API request fails.
 */
export async function requestBln3Score(inputs: Bln3ScoreInputs): Promise<Bln3Score | null> {
  if (
    inputs.isExcluded ||
    inputs.b_bufferstrip === true ||
    inputs.b_lu_croprotation === "nature" ||
    inputs.b_lu_catalogue === "nl_343" ||
    inputs.b_lu_catalogue === "nl_6801"
  ) {
    return null
  }

  const { nmiApiKey, ...fieldData } = inputs

  if (!nmiApiKey) {
    throw new Error("NMI API key not provided")
  }

  try {
    const response = await bln3Client.request("https://api.nmi-agro.nl/maatwerk/bln3/score/field", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${nmiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(fieldData),
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
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new Error("BLN3 score request timed out. The NMI API did not respond in time.")
    }
    throw err
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

/**
 * Requests BLN3 measure applicability from the NMI API for a single field.
 *
 * Calls `POST /maatwerk/bln3/measure/applicability` with the provided field data and
 * returns per-measure applicability status ("applicable", "not yet applicable", "inapplicable")
 * and explanatory message. Each measure ID is prefixed with "bln_" (e.g. "bln_BM86") to match
 * FDM catalogue conventions.
 *
 * @param inputs - Field data and NMI API key. `a_lat`, `a_lon`, `b_year`, and `nmiApiKey` are required.
 * @returns A promise resolving to a `Bln3MeasureApplicabilityResult` containing an array of `applicability` items.
 * @throws If the NMI API key is not provided or the API request fails.
 */
export async function requestBln3MeasureApplicability(
  inputs: Bln3MeasureApplicabilityInputs,
): Promise<Bln3MeasureApplicabilityResult> {
  if (
    inputs.isExcluded ||
    inputs.b_bufferstrip === true ||
    inputs.b_lu_croprotation === "nature" ||
    inputs.b_lu_catalogue === "nl_343" ||
    inputs.b_lu_catalogue === "nl_6801"
  ) {
    return { applicability: [] }
  }

  const { nmiApiKey, ...fieldData } = inputs

  if (!nmiApiKey) {
    throw new Error("NMI API key not provided")
  }

  try {
    const response = await bln3Client.request(
      "https://api.nmi-agro.nl/maatwerk/bln3/measure/applicability",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${nmiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(fieldData),
      },
    )

    if (!response.ok) {
      const errorText = await response.text().catch(() => "")
      throw new Error(
        `BLN3 measure applicability request failed with status ${response.status}: ${response.statusText} - ${errorText}`,
      )
    }

    const result: Bln3MeasureApplicabilityResponse = await response.json()
    if (!result.success) {
      throw new Error(
        `BLN3 measure applicability API returned failure (status ${result.status}): ${result.message ?? "Unknown error"}`,
      )
    }

    if (!result.data || !Array.isArray(result.data.applicability)) {
      throw new Error(
        "BLN3 measure applicability API returned a malformed payload (missing data or applicability array)",
      )
    }

    const validStatuses = new Set(["applicable", "not yet applicable", "inapplicable"])
    for (const item of result.data.applicability) {
      if (
        !item ||
        typeof item.m_id !== "string" ||
        item.m_id.trim().length === 0 ||
        !validStatuses.has(item.applicability) ||
        typeof item.message !== "string"
      ) {
        throw new Error(
          "BLN3 measure applicability API returned a malformed payload (invalid item in applicability array)",
        )
      }
    }

    // Map m_id to "bln_" prefixed format to match FDM CatalogueMeasureItem.m_id convention
    return {
      applicability: result.data.applicability.map((item) => ({
        ...item,
        m_id: item.m_id.startsWith("bln_") ? item.m_id : `bln_${item.m_id}`,
      })),
    }
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new Error(
        "BLN3 measure applicability request timed out. The NMI API did not respond in time.",
      )
    }
    throw err
  }
}

/**
 * Cached version of `requestBln3MeasureApplicability`.
 *
 * Uses `withCalculationCache` to store and retrieve results from the
 * `fdm-calculator.calculation_cache` table. The cache key is a SHA-256 hash
 * of the function name, calculator version, and sanitized inputs (API key
 * redacted). Bumping `calculatorVersion` in `package.ts` invalidates all
 * existing cache entries.
 */
export const getBln3MeasureApplicability = withCalculationCache(
  requestBln3MeasureApplicability,
  "requestBln3MeasureApplicability",
  pkg.calculatorVersion,
  ["nmiApiKey"],
)

/**
 * Requests BLN3 measure advice from the NMI API for a single field.
 *
 * Calls `POST /maatwerk/bln3/measure/advice` with the provided field data and
 * returns, per indicator, a list of candidate measures ranked by their
 * predicted impact on that indicator. Each measure ID is prefixed with
 * "bln_" (e.g. "bln_BM226") to match FDM catalogue conventions.
 * If the field is excluded (buffer strip or nature crop rotation), returns
 * `null` immediately without calling the API.
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
 * @returns A promise resolving to a `Bln3MeasureAdviceResult` containing `indicator_advice`, or `null` if excluded.
 * @throws If the NMI API key is not provided or the API request fails.
 */
export async function requestBln3MeasureAdvice(
  inputs: Bln3MeasureAdviceInputs,
): Promise<Bln3MeasureAdviceResult | null> {
  if (
    inputs.isExcluded ||
    inputs.b_bufferstrip === true ||
    inputs.b_lu_croprotation === "nature" ||
    inputs.b_lu_catalogue === "nl_343" ||
    inputs.b_lu_catalogue === "nl_6801"
  ) {
    return null
  }

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
