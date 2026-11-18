/**
 * Colours of grazing zones, shared by the zone editor, its legend, the field's zone map and the
 * Atlas layer Beweiding. Kept apart from the maps, which are lazy-loaded, so the legend does not
 * pull maplibre-gl and terra-draw into the bundle.
 *
 * Grassland is green on an aerial photo, so a zone is not drawn in green: it gets a light white
 * wash and a solid white outline, with a dark casing where the map draws it. The field keeps the
 * white dotted outline of the Atlas layers, so the solid line of the zone stands apart from it.
 */

/** Fill of a zone: a light wash that brightens the grass beneath it. */
export const ZONE_FILL_COLOR = "#ffffff"
/** Opacity of the zone fill. */
export const ZONE_FILL_OPACITY = 0.35

/** Outline of a zone. */
export const ZONE_OUTLINE_COLOR = "#ffffff"
/** Width of the zone outline in pixels. */
export const ZONE_OUTLINE_WIDTH = 3

/** Dark casing under the zone outline, so the white line also reads on a light background. */
export const ZONE_CASING_COLOR = "#022c22"
/** Width of the casing in pixels, wider than the outline so it shows on both sides. */
export const ZONE_CASING_WIDTH = 6

/** Corner points of a zone while drawing or editing: dark with a white ring. */
export const ZONE_POINT_COLOR = "#022c22"

/** Earlier strips shown for reference: a dark wash with a dashed white outline. */
export const OTHER_ZONE_COLOR = "#0f172a"
/** Opacity of the earlier strips' fill. */
export const OTHER_ZONE_FILL_OPACITY = 0.3

/** An earlier zone the user points at, in the yellow of the selected field elsewhere in the app. */
export const HIGHLIGHT_ZONE_COLOR = "#ffcf0d"
