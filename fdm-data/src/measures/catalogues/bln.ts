import type {
  CatalogueMeasure,
  CatalogueMeasureCondition,
  CatalogueMeasureEffectSize,
  CatalogueMeasureItem,
} from "../d"

interface BLN3ApiMeasure {
  m_id: string
  m_name: string
  m_summary?: string | null
  m_description?: string | null
  m_source?: string | null
  m_source_url?: string | null
  m_conflicts?: string[] | null
  m_applicability?: CatalogueMeasureCondition[] | null
  m_effect_costs?: number | null
  m_effect_type?: string | null
  m_impacts_score?: string[] | null
  m_effect_size?: CatalogueMeasureEffectSize[] | null
  // IDs in related schemes, e.g. m_id_bbwp, m_id_ecoregeling24
  [key: `m_id_${string}`]: unknown
}

const FETCH_TIMEOUT_MS = 30_000

/** ID fields of the API that are not stored as external IDs */
const OWN_ID_FIELDS = new Set(["m_id", "m_id_bln"])

/**
 * Fetches the BLN3 measures catalogue from the NMI API.
 *
 * Transforms the API response from BLN3-specific naming to the pandex naming
 * convention used throughout FDM. The `bln_id` is namespaced as `m_id = "bln_{bln_id}"`
 * so measures from different frameworks can coexist in the same table. The `m_source` of
 * the API (where the measure comes from) is stored as `m_origin`, because `m_source` in
 * FDM is the name of the catalogue.
 *
 * @param nmiApiKey - Bearer token for the NMI API
 * @returns Array of catalogue items in pandex naming convention
 */
export async function getCatalogueBln(nmiApiKey: string): Promise<CatalogueMeasure> {
  let res: Response
  try {
    res = await fetch("https://api.nmi-agro.nl/maatwerk/bln3/measures", {
      headers: { Authorization: `Bearer ${nmiApiKey}` },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      throw new Error(`Fetching BLN measures catalogue timed out after ${FETCH_TIMEOUT_MS}ms`)
    }
    throw err
  }
  if (!res.ok) {
    throw new Error(`Failed to fetch BLN measures catalogue: ${res.status} ${res.statusText}`)
  }
  const json = await res.json()
  if (!json?.data || !Array.isArray(json.data.measures)) {
    throw new Error(
      `Unexpected response shape from BLN measures catalogue API: expected json.data.measures to be an array, got ${JSON.stringify(json)}`,
    )
  }
  return json.data.measures
    .filter((item: BLN3ApiMeasure) => {
      return (
        typeof item.m_id === "string" &&
        item.m_id.trim().length > 0 &&
        typeof item.m_name === "string" &&
        item.m_name.trim().length > 0
      )
    })
    .map((item: BLN3ApiMeasure): CatalogueMeasureItem => {
      const applicability = Array.isArray(item.m_applicability) ? item.m_applicability : null
      return {
        m_id: `bln_${item.m_id}`,
        m_source: "bln",
        m_name: item.m_name,
        m_description: item.m_description ?? null,
        m_summary: item.m_summary ?? null,
        m_source_url: item.m_source_url ?? null,
        m_conflicts: Array.isArray(item.m_conflicts)
          ? item.m_conflicts.map((id) => `bln_${id}`)
          : null,
        m_stage_applicability: (() => {
          const val = applicability?.find((a) => a.variable === "M_STAGE_APPLICABILITY")
            ?.values?.[0]
          return val === "field" || val === "farm" ? val : null
        })(),
        m_effect_costs:
          typeof item.m_effect_costs === "number" && Number.isFinite(item.m_effect_costs)
            ? item.m_effect_costs
            : null,
        m_effect_type: typeof item.m_effect_type === "string" ? item.m_effect_type : null,
        m_impacts_score: Array.isArray(item.m_impacts_score) ? item.m_impacts_score : null,
        m_applicability: applicability,
        m_effect_size: Array.isArray(item.m_effect_size) ? item.m_effect_size : null,
        m_origin:
          typeof item.m_source === "string" && item.m_source.trim().length > 0
            ? item.m_source.trim()
            : null,
        m_external_ids: getExternalIds(item),
      }
    })
}

/**
 * Collects the IDs of a measure in related schemes from the `m_id_*` fields of the API,
 * e.g. `m_id_bbwp: "B121"` becomes `{ bbwp: "B121" }`.
 *
 * @param item - Measure as returned by the API.
 * @returns The external IDs, or `null` when there are none.
 */
function getExternalIds(item: BLN3ApiMeasure): Record<string, string> | null {
  const ids: Record<string, string> = {}
  for (const [key, value] of Object.entries(item)) {
    if (!key.startsWith("m_id_") || OWN_ID_FIELDS.has(key)) continue
    if (typeof value === "string" && value.trim().length > 0) {
      ids[key.replace(/^m_id_/, "")] = value.trim()
    }
  }
  return Object.keys(ids).length > 0 ? ids : null
}
