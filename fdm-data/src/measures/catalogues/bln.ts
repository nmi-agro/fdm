import type { CatalogueMeasure } from "../d"

interface BLN3ApiMeasure {
    bln_id: string
    name: string
    summary: string | null
    description: string | null
    source_url: string | null
    conflicts_with_measure: string[] | null
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
export async function getCatalogueBln(
    nmiApiKey: string,
): Promise<CatalogueMeasure> {
    let res: Response
    try {
        res = await fetch("https://api.nmi-agro.nl/maatwerk/bln3/measures", {
            headers: { Authorization: `Bearer ${nmiApiKey}` },
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        })
    } catch (err) {
        if (err instanceof DOMException && err.name === "TimeoutError") {
            throw new Error(
                `Fetching BLN measures catalogue timed out after ${FETCH_TIMEOUT_MS}ms`,
            )
        }
        throw err
    }
    if (!res.ok) {
        throw new Error(
            `Failed to fetch BLN measures catalogue: ${res.status} ${res.statusText}`,
        )
    }
    const json = await res.json()
    if (!json?.data || !Array.isArray(json.data.measures)) {
        throw new Error(
            `Unexpected response shape from BLN measures catalogue API: expected json.data.measures to be an array, got ${JSON.stringify(json)}`,
        )
    }
    return json.data.measures.map((item: BLN3ApiMeasure) => ({
        m_id: `bln_${item.bln_id}`,
        m_source: "bln",
        m_name: item.name,
        m_description: item.description ?? null,
        m_summary: item.summary ?? null,
        m_source_url: item.source_url ?? null,
        m_conflicts:
            item.conflicts_with_measure?.map((id) => `bln_${id}`) ?? null,
    }))
}
