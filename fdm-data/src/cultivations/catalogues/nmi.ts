const NMI_CULTIVATIONS_URL = "https://api.nmi-agro.nl/lookup/cultivations?b_region=nl"
const FETCH_TIMEOUT_MS = 30_000

/**
 * Phosphate contents of a cultivation, as provided by the NMI API.
 *
 * Both values are in g P2O5 / kg dry matter (the same basis as the nitrogen contents) and are
 * `null` when the NMI API has no value.
 */
export interface NmiCultivationPhosphate {
  b_lu_p_harvestable: number | null
  b_lu_p_residue: number | null
}

interface NmiApiCultivation {
  b_lu_brp?: number | null
  b_p_harvestable?: unknown
  b_p_residue?: unknown
}

function toNumberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null
}

/**
 * Fetches the phosphate contents of Dutch cultivations from the NMI API lookup.
 *
 * The NMI API (`GET /lookup/cultivations`) returns per BRP code the phosphate content of the
 * harvestable product (`b_p_harvestable`) and of the crop residue (`b_p_residue`) in g P2O5 / kg dry matter.
 * The result is keyed by the BRP cultivation code, so it can be joined to the BRP catalogue.
 *
 * @param nmiApiKey - Bearer token for the NMI API.
 * @returns A map from BRP cultivation code (e.g. `265`) to its phosphate contents.
 * @throws {Error} When the request fails, times out or returns an unexpected response.
 */
export async function getNmiCultivationPhosphate(
  nmiApiKey: string,
): Promise<Map<number, NmiCultivationPhosphate>> {
  let res: Response
  try {
    res = await fetch(NMI_CULTIVATIONS_URL, {
      headers: { Authorization: `Bearer ${nmiApiKey}` },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      throw new Error(`Fetching NMI cultivations lookup timed out after ${FETCH_TIMEOUT_MS}ms`)
    }
    throw err
  }
  if (!res.ok) {
    throw new Error(`Failed to fetch NMI cultivations lookup: ${res.status} ${res.statusText}`)
  }
  const json = await res.json()
  if (!json?.data || !Array.isArray(json.data.cultivations)) {
    throw new Error(
      "Unexpected response shape from NMI cultivations lookup: expected data.cultivations to be an array",
    )
  }

  const phosphate = new Map<number, NmiCultivationPhosphate>()
  for (const cultivation of json.data.cultivations as NmiApiCultivation[]) {
    if (typeof cultivation.b_lu_brp !== "number") continue
    phosphate.set(cultivation.b_lu_brp, {
      b_lu_p_harvestable: toNumberOrNull(cultivation.b_p_harvestable),
      b_lu_p_residue: toNumberOrNull(cultivation.b_p_residue),
    })
  }
  return phosphate
}
