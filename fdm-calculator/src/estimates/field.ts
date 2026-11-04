import type { FdmType, FieldGeometry, PrincipalId } from "@nmi-agro/fdm-core"
import { addSoilAnalysis } from "@nmi-agro/fdm-core"
import type { SoilParameterEstimatesResponse } from "./types"
import { getSoilParameterEstimates } from "./index"

/**
 * Returns the centroid of a field geometry as the mean of its vertices, ignoring the closing
 * vertex of each ring. This matches the centroid that `@turf/centroid` computes.
 *
 * @param geometry - A Polygon or MultiPolygon in WGS84.
 * @returns `[longitude, latitude]`.
 */
export function getGeometryCentroid(geometry: FieldGeometry): [number, number] {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates
  let lon = 0
  let lat = 0
  let count = 0
  for (const polygon of polygons) {
    for (const ring of polygon) {
      // Every vertex except the closing one, which repeats the first.
      for (const position of ring.slice(0, -1)) {
        lon += position[0] as number
        lat += position[1] as number
        count++
      }
    }
  }
  if (count === 0) throw new Error("Geometry has no coordinates")
  return [lon / count, lat / count]
}

/**
 * Requests soil parameter estimates for the centroid of a geometry from the NMI estimates service.
 *
 * @param fdm - The FDM instance, used for the calculation cache.
 * @param geometry - Geometry of the field.
 * @param nmiApiKey - The NMI API key.
 * @returns The estimated soil parameters.
 */
export function getSoilParameterEstimatesForGeometry(
  fdm: FdmType,
  geometry: FieldGeometry,
  nmiApiKey: string | undefined,
): Promise<SoilParameterEstimatesResponse> {
  const [a_lon, a_lat] = getGeometryCentroid(geometry)
  return getSoilParameterEstimates(fdm, { a_lat, a_lon, nmiApiKey })
}

/**
 * Adds estimated soil parameters to a field as a soil analysis with source `nl-other-nmi`.
 * Used after a field is created, so it has soil data before any lab analysis is entered.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - The principal adding the analysis. Needs write access to the field.
 * @param b_id - The field.
 * @param geometry - Geometry of the field, used to locate the estimates.
 * @param nmiApiKey - The NMI API key.
 * @returns The ID of the new soil analysis.
 */
export async function addSoilParameterEstimatesToField(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id: string,
  geometry: FieldGeometry,
  nmiApiKey: string | undefined,
): Promise<string> {
  const estimates = await getSoilParameterEstimatesForGeometry(fdm, geometry, nmiApiKey)
  return addSoilAnalysis(
    fdm,
    principal_id,
    undefined,
    "nl-other-nmi",
    b_id,
    estimates.a_depth_lower ?? 30,
    undefined,
    estimates,
    estimates.a_depth_upper,
  )
}
