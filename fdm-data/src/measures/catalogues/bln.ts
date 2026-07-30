import type { CatalogueMeasure } from "../d"

interface BLN3ApiMeasure {
  m_id: string
  m_name: string
  m_summary: string | null
  m_description: string | null
  m_source_url: string | null
  m_conflicts: string[] | null
  m_applicability: { variable: string; values: string[] }[]
}

const FETCH_TIMEOUT_MS = 30_000

/**
 * Fetches the BLN3 measures catalogue from the NMI API.
 *
 * Transforms the API response from BLN3-specific naming to the pandex naming
 * convention used throughout FDM. The `bln_id` is namespaced as `m_id = "bln_{bln_id}"`
 * so measures from different frameworks can coexist in the same table.
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
    .map((item: BLN3ApiMeasure) => ({
      m_id: `bln_${item.m_id}`,
      m_source: "bln",
      m_name: item.m_name,
      m_description: item.m_description ?? null,
      m_summary: item.m_summary ?? null,
      m_source_url: item.m_source_url ?? null,
      m_conflicts: item.m_conflicts?.map((id) => `bln_${id}`) ?? null,
      m_stage_applicability: (() => {
        const val = item.m_applicability?.find((a) => a.variable === "M_STAGE_APPLICABILITY")
          ?.values[0]
        return val === "field" || val === "farm" ? val : null
      })(),
    }))
}
