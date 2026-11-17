/**
 * Client for the KvK Handelsregister Zoeken API (v2).
 *
 * Looks up a KvK number and maps the registry data to the farm fields
 * `b_name_farm`, `b_address_farm` and `b_postalcode_farm`. The KvK APIs only
 * expose company data (no officials, owners or UBO data), so a lookup confirms
 * that a registration exists and is active. It does not prove that a user
 * represents the company.
 *
 * This module has no dependency on the app configuration, so the client can be
 * created with any key, base URL and `fetch` implementation.
 */

/** Pattern for a well-formed KvK number: exactly 8 digits. */
export const KVK_NUMBER_PATTERN = /^\d{8}$/

/** Options to create a {@link KvkClient}. */
export interface KvkClientOptions {
  /** API key, sent in the `apikey` request header. */
  apiKey: string
  /** Base URL of the KvK API, e.g. `https://api.kvk.nl/api` or `https://api.kvk.nl/test/api`. */
  baseUrl: string
  /** `fetch` implementation. Defaults to the global `fetch`. */
  fetchFn?: typeof fetch
  /** Request timeout in milliseconds. Defaults to 10 seconds. */
  timeoutMs?: number
  /** How long a lookup result is cached in memory, in milliseconds. Defaults to 1 hour. */
  cacheTtlMs?: number
}

/** Type of a result in the Zoeken API. */
export type KvkResultType = "hoofdvestiging" | "nevenvestiging" | "rechtspersoon"

/** Farm details found in the KvK Handelsregister. */
export interface KvkLookupFound {
  status: "found"
  kvkNumber: string
  /** Name of the company, maps to `b_name_farm`. */
  name: string
  /** Address as a single line, maps to `b_address_farm`. Undefined when KvK returns no street. */
  address?: string
  /** Postal code formatted as `1234 AB`, maps to `b_postalcode_farm`. Undefined when KvK returns none. */
  postalcode?: string
  /** True when the address includes a house number (i.e. it is complete enough to save as-is). */
  hasHouseNumber: boolean
  /** Whether the registration is active. */
  isActive: boolean
  /** Which result type was used for the mapping. */
  type: KvkResultType
}

/** No registration was found for the KvK number. */
export interface KvkLookupNotFound {
  status: "not_found"
  kvkNumber: string
}

/** The lookup failed. The upstream error message is intentionally not exposed. */
export interface KvkLookupError {
  status: "error"
  kvkNumber: string
  reason: "unauthorized" | "rate_limited" | "upstream" | "timeout"
}

/** Result of {@link KvkClient.lookupByKvk}. */
export type KvkLookupResult = KvkLookupFound | KvkLookupNotFound | KvkLookupError

/** Response of the app's KvK lookup route: a lookup result, or `disabled` when KvK is not configured. */
export type KvkLookupResponse = KvkLookupResult | { status: "disabled" }

/** Client for the KvK Zoeken API. */
export interface KvkClient {
  /**
   * Looks up a KvK number in the Handelsregister.
   *
   * @param kvkNumber - KvK number of 8 digits.
   * @returns The mapped farm details, or a `not_found`/`error` result.
   * @throws {KvkError} When `kvkNumber` is not a well-formed KvK number.
   */
  lookupByKvk(kvkNumber: string): Promise<KvkLookupResult>
}

/** Error thrown for invalid input to the KvK client. */
export class KvkError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "KvkError"
  }
}

/** Domestic address of a result in the Zoeken API. */
interface ZoekenBinnenlandsAdres {
  type?: string
  straatnaam?: string
  huisnummer?: number | string
  huisletter?: string
  huisnummerToevoeging?: string
  toevoegingAdres?: string
  postbusnummer?: number | string
  postcode?: string
  plaats?: string
}

/** A single result of the Zoeken API. */
export interface ZoekenResultaat {
  kvkNummer: string
  vestigingsnummer?: string
  naam: string
  type: string
  actief?: string
  vervallenNaam?: string
  adres?: { binnenlandsAdres?: ZoekenBinnenlandsAdres }
}

/** Response body of the Zoeken API. */
interface ZoekenResponse {
  totaal?: number
  resultaten?: ZoekenResultaat[]
  fout?: { code: string; omschrijving: string }[]
}

const MAX_CACHE_ENTRIES = 1000

/** KvK error code for a search without results. */
const KVK_NOT_FOUND_CODE = "IPD5200"

const RESULT_TYPE_PRIORITY: string[] = ["hoofdvestiging", "rechtspersoon", "nevenvestiging"]

/**
 * Selects the result that best represents the company.
 *
 * A KvK number can return several results: the legal entity (`rechtspersoon`),
 * the main establishment (`hoofdvestiging`) and branches (`nevenvestiging`).
 * Active results are preferred, then the main establishment, then the legal
 * entity, then a branch.
 *
 * @param resultaten - Results of the Zoeken API for one KvK number.
 * @returns The selected result, or undefined when there are no results.
 */
export function selectResult(resultaten: ZoekenResultaat[]): ZoekenResultaat | undefined {
  const rank = (r: ZoekenResultaat) => {
    const typeRank = RESULT_TYPE_PRIORITY.indexOf(r.type)
    const activeRank = r.actief === "Nee" ? 1 : 0
    return activeRank * 10 + (typeRank === -1 ? RESULT_TYPE_PRIORITY.length : typeRank)
  }
  return [...resultaten].sort((a, b) => rank(a) - rank(b))[0]
}

/**
 * Formats a Dutch postal code as `1234 AB`.
 *
 * @param postcode - Postal code as returned by KvK, e.g. `1034WL`.
 * @returns The formatted postal code, or the trimmed input when it is not a Dutch postal code.
 */
export function formatPostalCode(postcode: string): string {
  const compact = postcode.replace(/\s+/g, "").toUpperCase()
  const match = /^(\d{4})([A-Z]{2})$/.exec(compact)
  return match ? `${match[1]} ${match[2]}` : postcode.trim()
}

/**
 * Maps a Zoeken result to the farm fields.
 *
 * The address is a single line: `{straatnaam} {huisnummer}{huisletter}[-{toevoeging}], {plaats}`.
 * Parts that KvK does not return are left out. The Zoeken API does not always
 * return the house number and postal code, so these can be missing.
 *
 * @param result - A Zoeken result.
 * @returns The mapped farm details.
 */
export function mapZoekenResult(result: ZoekenResultaat): KvkLookupFound {
  const adres = result.adres?.binnenlandsAdres
  const straatnaam = adres?.straatnaam?.trim()
  const huisnummer = adres?.huisnummer !== undefined ? String(adres.huisnummer).trim() : ""
  const huisletter = adres?.huisletter?.trim() ?? ""
  const toevoeging = (adres?.huisnummerToevoeging ?? adres?.toevoegingAdres)?.trim()
  const plaats = adres?.plaats?.trim()

  let address: string | undefined
  if (straatnaam) {
    let street = straatnaam
    if (huisnummer) {
      street += ` ${huisnummer}${huisletter}`
      if (toevoeging) street += `-${toevoeging}`
    }
    address = plaats ? `${street}, ${plaats}` : street
  }

  const postcode = adres?.postcode?.trim()

  return {
    status: "found",
    kvkNumber: result.kvkNummer,
    name: result.naam.trim(),
    address,
    postalcode: postcode ? formatPostalCode(postcode) : undefined,
    hasHouseNumber: Boolean(straatnaam && huisnummer),
    isActive: result.actief !== "Nee",
    type: (RESULT_TYPE_PRIORITY.includes(result.type)
      ? result.type
      : "rechtspersoon") as KvkResultType,
  }
}

/**
 * Creates a client for the KvK Zoeken API.
 *
 * Results are cached in memory per KvK number to limit the number of paid
 * requests. Errors are not cached.
 *
 * @param options - API key, base URL and optional `fetch`, timeout and cache settings.
 * @returns A {@link KvkClient}.
 */
export function createKvkClient(options: KvkClientOptions): KvkClient {
  const { apiKey, fetchFn = fetch, timeoutMs = 10_000, cacheTtlMs = 60 * 60 * 1000 } = options
  const baseUrl = options.baseUrl.replace(/\/+$/, "")
  const cache = new Map<string, { result: KvkLookupResult; expires: number }>()

  async function lookupByKvk(kvkNumber: string): Promise<KvkLookupResult> {
    const kvk = kvkNumber.trim()
    if (!KVK_NUMBER_PATTERN.test(kvk)) {
      throw new KvkError("KvK number must consist of 8 digits")
    }

    const now = Date.now()
    const cached = cache.get(kvk)
    if (cached && cached.expires > now) return cached.result
    cache.delete(kvk)

    const url = new URL(`${baseUrl}/v2/zoeken`)
    url.searchParams.set("kvkNummer", kvk)
    // Without this flag inactive registrations are omitted and `actief` is not returned
    url.searchParams.set("inclusiefInactieveRegistraties", "true")

    let response: Response
    try {
      response = await fetchFn(url, {
        headers: { apikey: apiKey, accept: "application/json" },
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch (error) {
      const isTimeout =
        error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")
      return { status: "error", kvkNumber: kvk, reason: isTimeout ? "timeout" : "upstream" }
    }

    if (response.status === 404) {
      // KvK answers "no registration found" with error code IPD5200. Any other 404
      // (e.g. a wrong base URL) is a configuration or upstream problem and is not cached.
      const errorBody = (await response.json().catch(() => undefined)) as ZoekenResponse | undefined
      if (errorBody?.fout?.some((fout) => fout.code === KVK_NOT_FOUND_CODE)) {
        return remember({ status: "not_found", kvkNumber: kvk })
      }
      return { status: "error", kvkNumber: kvk, reason: "upstream" }
    }
    if (response.status === 401 || response.status === 403) {
      return { status: "error", kvkNumber: kvk, reason: "unauthorized" }
    }
    if (response.status === 429) {
      return { status: "error", kvkNumber: kvk, reason: "rate_limited" }
    }
    if (!response.ok) {
      return { status: "error", kvkNumber: kvk, reason: "upstream" }
    }

    let body: ZoekenResponse
    try {
      body = (await response.json()) as ZoekenResponse
    } catch {
      return { status: "error", kvkNumber: kvk, reason: "upstream" }
    }

    if (body.fout?.length) {
      return { status: "error", kvkNumber: kvk, reason: "upstream" }
    }

    const results = (body.resultaten ?? []).filter((r) => r.kvkNummer === kvk && r.naam)
    const selected = selectResult(results)
    if (!selected) {
      return remember({ status: "not_found", kvkNumber: kvk })
    }

    return remember(mapZoekenResult(selected))

    function remember(result: KvkLookupResult): KvkLookupResult {
      if (cache.size >= MAX_CACHE_ENTRIES) {
        // Map keeps insertion order, so the first key is the oldest entry
        const oldest = cache.keys().next().value
        if (oldest !== undefined) cache.delete(oldest)
      }
      cache.set(kvk, { result, expires: now + cacheTtlMs })
      return result
    }
  }

  return { lookupByKvk }
}
