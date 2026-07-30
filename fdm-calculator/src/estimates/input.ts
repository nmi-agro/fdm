import type { FdmType, fdmSchema, PrincipalId } from "@nmi-agro/fdm-core"
import { getField } from "@nmi-agro/fdm-core"
import type { SoilParameterEstimatesInput } from "./types"

/**
 * Resolves the centroid coordinates for a persisted field and builds the input
 * bundle expected by `getSoilParameterEstimates`/`requestSoilParameterEstimates`.
 *
 * The centroid is computed in Postgres (`ST_Centroid`/`ST_X`/`ST_Y`, see `getField`
 * in `fdm-core/src/field.ts`) rather than recomputed client-side.
 *
 * @param fdm - The FDM instance for database interaction.
 * @param principal_id - The principal making the request.
 * @param b_id - The field ID to resolve the centroid for.
 * @param nmiApiKey - The NMI API key for authentication.
 * @returns A promise resolving to the collected soil parameter estimates input.
 * @throws {Error} If the field cannot be found or access is denied.
 */
export async function collectInputForSoilParameterEstimates(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id: fdmSchema.fieldsTypeSelect["b_id"],
  nmiApiKey: string | undefined,
): Promise<SoilParameterEstimatesInput> {
  const field = await getField(fdm, principal_id, b_id)

  // b_centroid = [lon, lat] (ST_X = longitude, ST_Y = latitude)
  const [a_lon, a_lat] = field.b_centroid

  return {
    a_lat,
    a_lon,
    nmiApiKey,
  }
}
