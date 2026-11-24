import type { FdmType, PrincipalId } from "@nmi-agro/fdm-core"
import {
  getDefaultDatesOfCultivation,
  getDefaultDatesOfCultivations,
  getFields,
} from "@nmi-agro/fdm-core"
import { getCultivationCatalogue } from "@nmi-agro/fdm-data"
import { getSoilParameterEstimates } from "../estimates/index"
import { collectInputForSoilParameterEstimates } from "../estimates/input"

/**
 * A suggested main cultivation for a field, derived from the crop registered for that field in
 * the Dutch crop registration (BRP).
 */
export type CultivationSuggestion = {
  /** Cultivation catalogue code of the suggested crop, for example `nl_265`. */
  b_lu_catalogue: string
  /** Name of the suggested crop. */
  b_lu_name: string
  /** Default sowing date of this crop in the requested year, from the cultivation catalogue. */
  b_lu_start: Date
  /** Default end date of this crop, or `undefined` for crops that are not harvested once (for example grassland). */
  b_lu_end: Date | undefined
}

/**
 * Outcome of a cultivation-suggestion lookup. Tells "nothing to suggest" apart from
 * "the lookup could not be done".
 */
export type CultivationSuggestionResult =
  | { status: "suggested"; suggestion: CultivationSuggestion }
  /** No NMI API key is configured, so suggestions are disabled. */
  | { status: "not_configured" }
  /** The lookup succeeded, but there is no BRP crop for this field and year. */
  | { status: "no_estimate" }
  /** The lookup failed (network or validation error). */
  | { status: "unavailable" }

/**
 * Suggests a main cultivation for a field and year from the BRP crop that the NMI estimates
 * service returns for the field's location. Use it when no main cultivation is registered.
 *
 * Never throws: a suggestion is optional extra information and must not break a page or a request.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - The principal making the request.
 * @param b_id_farm - The farm of the field, used to resolve the crop's default dates.
 * @param b_id - The field to suggest a cultivation for.
 * @param year - The calendar year to look up.
 * @param nmiApiKey - The NMI API key, or `undefined` when not configured.
 * @returns The suggestion, or the reason why there is none.
 */
export async function getCultivationSuggestionResult(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: string,
  b_id: string,
  year: number | string,
  nmiApiKey: string | undefined,
): Promise<CultivationSuggestionResult> {
  if (!nmiApiKey) {
    return { status: "not_configured" }
  }

  try {
    const estimatesInput = await collectInputForSoilParameterEstimates(
      fdm,
      principal_id,
      b_id,
      nmiApiKey,
    )
    const [estimates, cultivationCatalogue] = await Promise.all([
      getSoilParameterEstimates(fdm, estimatesInput),
      getCultivationCatalogue("brp"),
    ])

    const estimateForYear = estimates.cultivations.find((c) => c.year === Number(year))
    if (!estimateForYear) {
      return { status: "no_estimate" }
    }

    const b_lu_catalogue = `nl_${estimateForYear.b_lu_brp}`
    const catalogueItem = cultivationCatalogue.find(
      (item) => item.b_lu_catalogue === b_lu_catalogue,
    )
    if (!catalogueItem) {
      return { status: "no_estimate" }
    }

    const { b_lu_start, b_lu_end } = await getDefaultDatesOfCultivation(
      fdm,
      principal_id,
      b_id_farm,
      b_lu_catalogue,
      Number(year),
    )

    return {
      status: "suggested",
      suggestion: {
        b_lu_catalogue,
        b_lu_name: catalogueItem.b_lu_name,
        b_lu_start,
        b_lu_end,
      },
    }
  } catch (error) {
    console.error(
      `Failed to compute cultivation suggestion for field ${b_id}, year ${year}:`,
      error,
    )
    return { status: "unavailable" }
  }
}

/**
 * Default number of NMI estimates requests that {@link getCultivationSuggestionResultsForFarm}
 * runs at the same time.
 */
const DEFAULT_SUGGESTION_CONCURRENCY = 4

/**
 * Suggests a main cultivation for several fields of a farm, with the same result per field as
 * {@link getCultivationSuggestionResult}.
 *
 * The database is read with a fixed number of queries, whatever the number of fields: the
 * fields (with their centroids) once, the cached estimates once, and the default dates of the
 * suggested crops once. Only the estimates that are not cached yet are requested from the NMI
 * API, at most `concurrency` at the same time.
 *
 * Never throws: a suggestion is optional extra information and must not break a page or a request.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - The principal making the request.
 * @param b_id_farm - The farm of the fields.
 * @param b_ids - The fields to suggest a cultivation for. A field that is not part of the farm gets the status `unavailable`.
 * @param year - The calendar year to look up.
 * @param nmiApiKey - The NMI API key, or `undefined` when not configured.
 * @param options - `concurrency`: the maximum number of simultaneous NMI API requests (default 4).
 * @returns A map of field ID to the suggestion or the reason why there is none, with an entry for every requested field, in the order of `b_ids`.
 */
export async function getCultivationSuggestionResultsForFarm(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: string,
  b_ids: string[],
  year: number | string,
  nmiApiKey: string | undefined,
  options: { concurrency?: number } = {},
): Promise<Map<string, CultivationSuggestionResult>> {
  const ids = [...new Set(b_ids)]
  const results = new Map<string, CultivationSuggestionResult>()
  const setUnavailable = (b_id: string, error: unknown) => {
    console.error(
      `Failed to compute cultivation suggestion for field ${b_id}, year ${year}:`,
      error,
    )
    results.set(b_id, { status: "unavailable" })
  }
  /** The results in the order of the requested fields. */
  const ordered = () =>
    new Map<string, CultivationSuggestionResult>(
      ids.map((b_id) => [b_id, results.get(b_id) ?? { status: "unavailable" }]),
    )

  if (ids.length === 0) {
    return results
  }
  if (!nmiApiKey) {
    return new Map(ids.map((b_id) => [b_id, { status: "not_configured" }]))
  }

  // The fields of the farm, with their centroids
  let centroids: Map<string, [number, number]>
  try {
    const fields = await getFields(fdm, principal_id, b_id_farm)
    centroids = new Map(fields.map((field) => [field.b_id, field.b_centroid]))
  } catch (error) {
    for (const b_id of ids) setUnavailable(b_id, error)
    return ordered()
  }
  const located = ids.filter((b_id) => {
    if (centroids.has(b_id)) return true
    setUnavailable(b_id, new Error("Field not found in farm"))
    return false
  })

  // The estimates of the fields: one cache read, and a limited number of NMI requests at once
  const estimates = await Promise.allSettled(
    getSoilParameterEstimates.many(
      fdm,
      located.map((b_id) => {
        // b_centroid = [lon, lat] (ST_X = longitude, ST_Y = latitude)
        const [a_lon, a_lat] = centroids.get(b_id) as [number, number]
        return { a_lat, a_lon, nmiApiKey }
      }),
      { concurrency: options.concurrency ?? DEFAULT_SUGGESTION_CONCURRENCY },
    ),
  )

  let cultivationCatalogue: Awaited<ReturnType<typeof getCultivationCatalogue>>
  try {
    cultivationCatalogue = await getCultivationCatalogue("brp")
  } catch (error) {
    for (const b_id of located) setUnavailable(b_id, error)
    return ordered()
  }

  // The BRP crop of each field in the year
  const candidates: { b_id: string; b_lu_catalogue: string; b_lu_name: string }[] = []
  located.forEach((b_id, index) => {
    const estimate = estimates[index]
    if (estimate.status === "rejected") {
      setUnavailable(b_id, estimate.reason)
      return
    }
    const estimateForYear = estimate.value.cultivations.find((c) => c.year === Number(year))
    if (!estimateForYear) {
      results.set(b_id, { status: "no_estimate" })
      return
    }
    const b_lu_catalogue = `nl_${estimateForYear.b_lu_brp}`
    const catalogueItem = cultivationCatalogue.find(
      (item) => item.b_lu_catalogue === b_lu_catalogue,
    )
    if (!catalogueItem) {
      results.set(b_id, { status: "no_estimate" })
      return
    }
    candidates.push({ b_id, b_lu_catalogue, b_lu_name: catalogueItem.b_lu_name })
  })
  if (candidates.length === 0) {
    return ordered()
  }

  // The default dates of the suggested crops, read once
  let defaultDates: Awaited<ReturnType<typeof getDefaultDatesOfCultivations>>
  try {
    defaultDates = await getDefaultDatesOfCultivations(
      fdm,
      principal_id,
      b_id_farm,
      [...new Set(candidates.map((candidate) => candidate.b_lu_catalogue))],
      Number(year),
    )
  } catch (error) {
    for (const { b_id } of candidates) setUnavailable(b_id, error)
    return ordered()
  }

  for (const { b_id, b_lu_catalogue, b_lu_name } of candidates) {
    const dates = defaultDates.get(b_lu_catalogue)
    if (!dates) {
      setUnavailable(b_id, new Error("Cultivation not found in catalogue"))
      continue
    }
    results.set(b_id, {
      status: "suggested",
      suggestion: {
        b_lu_catalogue,
        b_lu_name,
        b_lu_start: dates.b_lu_start,
        b_lu_end: dates.b_lu_end,
      },
    })
  }
  return ordered()
}

/**
 * Same as {@link getCultivationSuggestionResult}, but returns only the suggestion.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - The principal making the request.
 * @param b_id_farm - The farm of the field.
 * @param b_id - The field to suggest a cultivation for.
 * @param year - The calendar year to look up.
 * @param nmiApiKey - The NMI API key, or `undefined` when not configured.
 * @returns The suggestion, or `undefined` when there is none.
 */
export async function getCultivationSuggestion(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: string,
  b_id: string,
  year: number | string,
  nmiApiKey: string | undefined,
): Promise<CultivationSuggestion | undefined> {
  const result = await getCultivationSuggestionResult(
    fdm,
    principal_id,
    b_id_farm,
    b_id,
    year,
    nmiApiKey,
  )
  return result.status === "suggested" ? result.suggestion : undefined
}
