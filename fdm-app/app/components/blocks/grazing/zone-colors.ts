/**
 * Colours of the grazing zone editor, shared by the map and its legend. Kept apart from the map,
 * which is lazy-loaded, so the legend does not pull maplibre-gl and terra-draw into the bundle.
 */

/** Fill of the zone being edited. */
export const ZONE_COLOR = "#10b981"

/** Outline of the zone being edited. */
export const ZONE_OUTLINE_COLOR = "#047857"

/** Earlier strips shown for reference. */
export const OTHER_ZONE_COLOR = "#64748b"
