import type { FdmType, PrincipalId } from "@nmi-agro/fdm-core"
import {
  collectInputForSoilParameterEstimates,
  getSoilParameterEstimates,
} from "@nmi-agro/fdm-calculator"
import { getDefaultDatesOfCultivation } from "@nmi-agro/fdm-core"
import { getCultivationCatalogue } from "@nmi-agro/fdm-data"

export type CultivationSuggestion = {
  b_lu_catalogue: string
  b_lu_name: string
  /** Default sowing date for this crop/year, sourced from the cultivation catalogue (same logic used for RVO/shapefile imports via `getDefaultDatesOfCultivation`). */
  b_lu_start: Date
  /** Default harvest/end date for this crop/year, or `undefined` for crops that aren't harvested once (e.g. grassland). */
  b_lu_end: Date | undefined
}

/**
 * Outcome of a cultivation-suggestion lookup, distinguishing *why* no suggestion is available
 * so the higher-visibility surfaces (dashboard, field detail) can tell "nothing to suggest"
 * apart from "we couldn't check" instead of rendering identical silence for both.
 */
export type CultivationSuggestionResult =
  | { status: "suggested"; suggestion: CultivationSuggestion }
  /** No NMI API key configured — the feature is fully disabled for this instance. */
  | { status: "not_configured" }
  /** NMI API key configured and the lookup succeeded, but no BRP entry exists for this year. */
  | { status: "no_estimate" }
  /** NMI API key configured, but the lookup itself failed (network/validation error). */
  | { status: "unavailable" }

/**
 * Suggests a main cultivation for a field/year based on the NMI Estimates endpoint's
 * BRP-derived cultivation guess (`cultivations: { year, b_lu_brp }[]`), for use when
 * `getDefaultCultivation` (the "May 15th" rule) finds no registered cultivation.
 *
 * Always resolves to a result rather than throwing — the suggestion is a nice-to-have
 * enrichment and must never block or break a page. See {@link CultivationSuggestionResult}
 * for the distinct "nothing to suggest" reasons this can resolve to.
 *
 * @param fdm - The FDM instance for database interaction.
 * @param principal_id - The principal making the request.
 * @param b_id_farm - The farm ID, used to resolve the suggested crop's default sowing/harvest dates.
 * @param b_id - The field ID to suggest a cultivation for.
 * @param year - The calendar year (string) to look up an estimate for.
 * @param nmiApiKey - The NMI API key for authentication, or `undefined` if not configured.
 */
export async function getCultivationSuggestionResult(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: string,
  b_id: string,
  year: string,
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

    // Resolve default sowing/harvest dates for this crop the same way the RVO/shapefile field
    // import flow does (see `farm.$b_id_farm.$calendar.field.new._index.tsx`), rather than a
    // fixed `<year>-01-01` placeholder.
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
 * Convenience wrapper around {@link getCultivationSuggestionResult} for call sites that only
 * care about the suggestion itself (dense table cells) and don't need to distinguish *why*
 * there is none.
 */
export async function getCultivationSuggestion(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: string,
  b_id: string,
  year: string,
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
