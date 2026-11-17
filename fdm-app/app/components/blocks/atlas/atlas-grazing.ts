import type { Feature, FeatureCollection, GeoJsonProperties, Geometry } from "geojson"
import type {
  ExpressionSpecification,
  FillLayerSpecification,
  LineLayerSpecification,
} from "maplibre-gl"
import type { GrazingMapStatus } from "~/lib/grazing-map"

/** Feature property that holds the {@link GrazingMapStatus} of a field. */
export const GRAZING_STATUS = "grazing_status"

/** Fill colour per status, shared by the map, the legend and the popup. */
export const GRAZING_STATUS_COLORS: Record<GrazingMapStatus, string> = {
  weiden: "#10b981",
  maaien: "#f59e0b",
  rust: "#86efac",
  unused: "#ffffff",
  // Same dark grey as fields without data in the other thematic layers
  disabled: "#4b5563",
}

/** Colours of a grazed zone, drawn on top of its field. */
const ZONE_FILL_COLOR = "#047857"
const ZONE_LINE_COLOR = "#064e3b"

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
  addHerd: "Naar veestapel",
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

/** Fill of a zone grazed on the shown day. */
export const GRAZING_ZONE_FILL_STYLE: { type: "fill"; paint: FillLayerSpecification["paint"] } = {
  type: "fill",
  paint: { "fill-color": ZONE_FILL_COLOR, "fill-opacity": 0.6 },
}

/** Outline of a zone grazed on the shown day. */
export const GRAZING_ZONE_LINE_STYLE: { type: "line"; paint: LineLayerSpecification["paint"] } = {
  type: "line",
  paint: { "line-color": ZONE_LINE_COLOR, "line-width": 2 },
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
