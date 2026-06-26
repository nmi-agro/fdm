import geojsonExtent from "@mapbox/geojson-extent"
import type { FeatureCollection } from "geojson"
import type { FitBoundsOptions, LngLatBoundsLike } from "maplibre-gl"
import type { ViewState } from "react-map-gl/maplibre"

export type AtlasViewState = Partial<ViewState> & {
  bounds?: LngLatBoundsLike
  fitBoundsOptions?: FitBoundsOptions
}

function getBounds(fields: FeatureCollection | null | undefined): LngLatBoundsLike {
  const initialBounds: [number, number, number, number] = [3.1, 50.7, 7.2, 53.6]

  let bounds: LngLatBoundsLike = initialBounds
  if (fields && fields.features.length > 0) {
    try {
      bounds = geojsonExtent(fields) as [number, number, number, number]
    } catch (error) {
      console.error("Failed to calculate bounds:", error)
    }
  }

  return bounds
}

export function getViewState(fields: FeatureCollection | null | undefined): AtlasViewState {
  if (fields) {
    const bounds = getBounds(fields)

    return {
      bounds,
      fitBoundsOptions: { padding: 100 },
      pitch: 0,
      bearing: 0,
      padding: { top: 0, bottom: 0, left: 0, right: 0 },
    }
  }

  return {
    longitude: 4.9,
    latitude: 52.2,
    zoom: 6,
    pitch: 0,
    bearing: 0,
    padding: { top: 0, bottom: 0, left: 0, right: 0 },
  }
}
