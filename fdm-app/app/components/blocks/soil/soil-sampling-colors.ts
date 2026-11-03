/** Fill and outline colour of the sampling zone on the soil sampling map. */
export const SAMPLING_ZONE_COLOR = "#2563eb"

/** Colour of the subsample locations on the soil sampling map. */
export const SAMPLING_POINT_COLOR = "#1e3a8a"

/**
 * Colours that tell the soil analyses of a field apart on the map and in the list. The green of the
 * field outline is left out, so that a zone never looks like the field boundary.
 */
const SOIL_ANALYSIS_COLORS = [
  "#2563eb",
  "#db2777",
  "#ea580c",
  "#7c3aed",
  "#0891b2",
  "#ca8a04",
  "#dc2626",
  "#4f46e5",
  "#65a30d",
  "#be185d",
]

/**
 * Returns the colour of the soil analysis at a position in the list (newest first). The colours
 * repeat after ten analyses.
 */
export function getSoilAnalysisColor(index: number): string {
  return SOIL_ANALYSIS_COLORS[index % SOIL_ANALYSIS_COLORS.length]
}
