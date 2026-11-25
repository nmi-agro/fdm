import type { Feature, FeatureCollection, GeoJsonProperties, Geometry } from "geojson"
import type {
  ExpressionSpecification,
  FillLayerSpecification,
  LineLayerSpecification,
} from "maplibre-gl"
import type { GrazingMapStatus } from "~/lib/grazing-map"
import {
  ZONE_CASING_COLOR,
  ZONE_CASING_WIDTH,
  ZONE_FILL_COLOR,
  ZONE_FILL_OPACITY,
  ZONE_OUTLINE_COLOR,
  ZONE_OUTLINE_WIDTH,
} from "~/components/blocks/grazing/zone-colors"
import { GRAZING_USE_COLORS } from "~/lib/grazing-status"

/** Feature property that holds the {@link GrazingMapStatus} of a field. */
export const GRAZING_STATUS = "grazing_status"

/**
 * Fill colour per status, shared by the map, the legend and the popup. Grazing, mowing and rest
 * take the colours of the grazing calendar.
 */
export const GRAZING_STATUS_COLORS: Record<GrazingMapStatus, string> = {
  weiden: GRAZING_USE_COLORS.weiden,
  maaien: GRAZING_USE_COLORS.maaien,
  rust: GRAZING_USE_COLORS.rust,
  unused: "#ffffff",
  // Same dark grey as fields without data in the other thematic layers
  disabled: "#4b5563",
}

/**
 * All Dutch UI copy of the layer in one place, so it can move to an i18n catalogue later.
 */
export const GRAZING_MAP_COPY = {
  layerName: "Beweiding",
  status: {
    weiden: "Beweid",
    maaien: "Gemaaid",
    rust: "In rust",
    unused: "Nog niet gebruikt",
    disabled: "Geen grasland",
  } satisfies Record<GrazingMapStatus, string>,
  previousDay: "Vorige dag",
  nextDay: "Volgende dag",
  backToToday: "Vandaag",
  backToDay: (label: string) => `Terug naar ${label}`,
  dayLabel: "Dag",
  addGrazing: "Beweiding toevoegen",
  openCalendar: "Beweidingskalender",
  clickHint: "Klik voor de beweiding van dit perceel",
  openField: "Bekijk beweiding",
  grazedBy: "Koppel",
  animals: (count: number) => `${count} ${count === 1 ? "dier" : "dieren"}`,
  hoursPerDay: "Uren per dag",
  zone: "Deel van het perceel (zone)",
  yieldLabel: "Opbrengst",
  restDays: (days: number) => `${days} ${days === 1 ? "dag" : "dagen"} rust`,
  lastGrazed: "Laatst beweid",
  lastMown: "Laatst gemaaid",
  unusedInYear: (year: number) => `Nog niet beweid of gemaaid in ${year}`,
  bufferstrip: "Bufferstrook",
  notGrassland: "Geen grasland in het bouwplan",
  noHerdTitle: "Nog geen koppel",
  noHerd: "De kaartlaag Beweiding wordt actief zodra je bedrijf een koppel heeft.",
  addHerd: "Naar Melkvee",
  showLegend: "Toon legenda",
  hideLegend: "Verberg legenda",
} as const

/**
 * Fill style of the layer, driven by {@link GRAZING_STATUS}. Fields that are not grassland recede,
 * as fields without data do in the other thematic layers.
 *
 * @returns Layer `type` and `paint` props.
 */
export function getGrazingFillStyle(): {
  type: "fill"
  paint: FillLayerSpecification["paint"]
} {
  return {
    type: "fill",
    paint: {
      "fill-color": [
        "match",
        ["get", GRAZING_STATUS],
        "weiden",
        GRAZING_STATUS_COLORS.weiden,
        "maaien",
        GRAZING_STATUS_COLORS.maaien,
        "rust",
        GRAZING_STATUS_COLORS.rust,
        "unused",
        GRAZING_STATUS_COLORS.unused,
        GRAZING_STATUS_COLORS.disabled,
      ],
      "fill-opacity": [
        "match",
        ["get", GRAZING_STATUS],
        "disabled",
        0.55,
        "unused",
        0.6,
        0.75,
      ] as ExpressionSpecification,
    },
  }
}

/**
 * Dark outline of a field grazed on the shown day, so a grazed field stands apart from a resting
 * one by more than its colour.
 */
export const GRAZING_GRAZED_OUTLINE_STYLE: {
  type: "line"
  filter: ExpressionSpecification
  paint: LineLayerSpecification["paint"]
} = {
  type: "line",
  filter: ["==", ["get", GRAZING_STATUS], "weiden"],
  paint: { "line-color": GRAZING_USE_COLORS.weidenOutline, "line-width": 3 },
}

/** Fill of a zone grazed on the shown day. */
export const GRAZING_ZONE_FILL_STYLE: { type: "fill"; paint: FillLayerSpecification["paint"] } = {
  type: "fill",
  paint: { "fill-color": ZONE_FILL_COLOR, "fill-opacity": ZONE_FILL_OPACITY },
}

/** Dark casing under the outline of a zone, as in the zone editor. */
export const GRAZING_ZONE_CASING_STYLE: { type: "line"; paint: LineLayerSpecification["paint"] } = {
  type: "line",
  paint: { "line-color": ZONE_CASING_COLOR, "line-width": ZONE_CASING_WIDTH },
}

/** Outline of a zone grazed on the shown day. */
export const GRAZING_ZONE_LINE_STYLE: { type: "line"; paint: LineLayerSpecification["paint"] } = {
  type: "line",
  paint: { "line-color": ZONE_OUTLINE_COLOR, "line-width": ZONE_OUTLINE_WIDTH },
}

/**
 * Counts the fields per status, for the legend.
 *
 * @param fields - Fields with {@link GRAZING_STATUS} in their properties.
 * @returns Number of fields per status; statuses without fields are 0.
 */
export function countGrazingStatuses(
  fields: FeatureCollection<Geometry, GeoJsonProperties>,
): Record<GrazingMapStatus, number> {
  const counts: Record<GrazingMapStatus, number> = {
    weiden: 0,
    maaien: 0,
    rust: 0,
    unused: 0,
    disabled: 0,
  }
  for (const feature of fields.features as Feature<Geometry, GeoJsonProperties>[]) {
    const status = feature.properties?.[GRAZING_STATUS] as GrazingMapStatus | undefined
    if (status && status in counts) counts[status] += 1
  }
  return counts
}
