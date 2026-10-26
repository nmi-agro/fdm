import {
  getCultivationsFromCatalogue,
  getDefaultsForHarvestParameters,
  type HarvestParametersDefault,
} from "@nmi-agro/fdm-core"
import { fdm } from "~/lib/fdm.server"

/**
 * Gets the default harvest parameters of a cultivation from the catalogues enabled for the farm.
 *
 * Returns an empty object when the cultivation is not in one of the enabled catalogues, so callers
 * can use it as an optional fallback (for example for harvests recorded before a parameter existed).
 *
 * @param principal_id - The principal requesting the defaults.
 * @param b_id_farm - The farm whose enabled catalogues are used.
 * @param b_lu_catalogue - The catalogue code of the cultivation.
 * @returns The default harvest parameters, or an empty object.
 */
export async function getCatalogueHarvestDefaults(
  principal_id: string,
  b_id_farm: string,
  b_lu_catalogue: string,
): Promise<HarvestParametersDefault> {
  const catalogue = await getCultivationsFromCatalogue(fdm, principal_id, b_id_farm)
  if (!catalogue.some((item) => item.b_lu_catalogue === b_lu_catalogue)) {
    return {}
  }
  return getDefaultsForHarvestParameters(b_lu_catalogue, catalogue)
}
