import type { FdmType, PrincipalId } from "@nmi-agro/fdm-core"
import { collectInputForSoilParameterEstimates, getSoilParameterEstimates } from "@nmi-agro/fdm-calculator"
import { getCultivationCatalogue } from "@nmi-agro/fdm-data"

export type CultivationSuggestion = {
  b_lu_catalogue: string
  b_lu_name: string
}

/**
 * Suggests a main cultivation for a field/year based on the NMI Estimates endpoint's
 * BRP-derived cultivation guess (`cultivations: { year, b_lu_brp }[]`), for use when
 * `getDefaultCultivation` (the "May 15th" rule) finds no registered cultivation.
 *
 * Always resolves to `undefined` rather than throwing — the suggestion is a nice-to-have
 * enrichment and must never block or break a page:
 * - No NMI API key configured (self-hosted/OSS instances without a subscription).
 * - No entry for the requested year in `cultivations` (current year before BRP data is
 *   published, a future year, or no BRP registration match for this field/location).
 * - Any failure calling the NMI API or resolving the catalogue entry (logged, not thrown).
 *
 * @param fdm - The FDM instance for database interaction.
 * @param principal_id - The principal making the request.
 * @param b_id - The field ID to suggest a cultivation for.
 * @param year - The calendar year (string) to look up an estimate for.
 * @param nmiApiKey - The NMI API key for authentication, or `undefined` if not configured.
 */
export async function getCultivationSuggestion(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id: string,
  year: string,
  nmiApiKey: string | undefined,
): Promise<CultivationSuggestion | undefined> {
  if (!nmiApiKey) {
    return undefined
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
      return undefined
    }

    const b_lu_catalogue = `nl_${estimateForYear.b_lu_brp}`
    const catalogueItem = cultivationCatalogue.find(
      (item) => item.b_lu_catalogue === b_lu_catalogue,
    )
    if (!catalogueItem) {
      return undefined
    }

    return {
      b_lu_catalogue,
      b_lu_name: catalogueItem.b_lu_name,
    }
  } catch (error) {
    console.error(
      `Failed to compute cultivation suggestion for field ${b_id}, year ${year}:`,
      error,
    )
    return undefined
  }
}
