import type { FdmType, PrincipalId } from "@nmi-agro/fdm-core"
import { getDefaultDatesOfCultivation } from "@nmi-agro/fdm-core"
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
