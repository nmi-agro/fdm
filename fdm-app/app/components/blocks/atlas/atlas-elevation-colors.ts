/**
 * Colour stops of the Atlas elevation layer, from low to high: ColorBrewer "Spectral" (11 classes),
 * reversed so low ground is blue and high ground is red. The map's colormap texture and the legend
 * gradient are both built from this list, so they always match.
 */
export const ELEVATION_COLOR_STOPS = [
  "#5e4fa2",
  "#3288bd",
  "#66c2a5",
  "#abdda4",
  "#e6f598",
  "#ffffbf",
  "#fee08b",
  "#fdae61",
  "#f46d43",
  "#d53e4f",
  "#9e0142",
] as const

/** CSS gradient of {@link ELEVATION_COLOR_STOPS} for the legend bar. */
export const ELEVATION_LEGEND_GRADIENT = `linear-gradient(to right, ${ELEVATION_COLOR_STOPS.join(", ")})`
