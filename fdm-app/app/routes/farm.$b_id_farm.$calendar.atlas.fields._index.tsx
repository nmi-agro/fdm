import type { FeatureCollection, Geometry } from "geojson"
import type { MetaFunction } from "react-router"
import { getFields } from "@nmi-agro/fdm-core"
import centroid from "@turf/centroid"
import { simplify } from "@turf/simplify"
import { useEffect, useState } from "react"
import { Layer, type LayerProps } from "react-map-gl/maplibre"
import { type LoaderFunctionArgs, useLoaderData, useNavigate, useParams } from "react-router"
import { MapTilerAttribution } from "~/components/blocks/atlas/atlas-attribution"
import { Controls } from "~/components/blocks/atlas/atlas-controls"
import { FieldTooltip } from "~/components/blocks/atlas/atlas-panels"
import { Atlas } from "~/components/blocks/atlas/atlas-shell"
import {
  FieldsSourceAvailable,
  FieldsSourceNotClickable,
} from "~/components/blocks/atlas/atlas-sources"
import { getFieldsStyle } from "~/components/blocks/atlas/atlas-styles"
import { ZOOM_LEVEL_FIELDS } from "~/components/blocks/atlas/atlas-util"
import { getViewState } from "~/components/blocks/atlas/atlas-viewstate"
import { useAnalytics } from "~/hooks/use-analytics"
import { getMapStyle } from "~/integrations/map"
import { getSession } from "~/lib/auth.server"
import { getCalendar, getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"

export const meta: MetaFunction = () => {
  return [
    { title: `Percelen - Atlas | ${clientConfig.name}` },
    {
      name: "description",
      content:
        "Bekijk alle percelen van uw bedrijf op één interactieve kaart. Visualiseer de geografische spreiding en onderlinge relaties tussen uw percelen.",
    },
  ]
}

/**
 * Loads and processes farm field data along with Maplibre configuration for rendering the farm atlas.
 *
 * This loader function extracts the farm ID from the route parameters and validates its presence,
 * retrieves the current user session, and fetches fields associated with the specified farm.
 * It converts these fields into a GeoJSON FeatureCollection—rounding the field area values for precision—
 * and obtains the Maplibre access token and style configuration for map rendering.
 *
 * @returns An object containing:
 *  - savedFields: A GeoJSON FeatureCollection of the farm fields.
 *  - MapStyle: The Maplibre style configuration.
 *
 * @throws {Response} If the farm ID is missing or if an error occurs during data retrieval and processing.
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    // Get the farm id
    const b_id_farm = params.b_id_farm

    // Get the session
    const session = await getSession(request)

    // Get timeframe from calendar store
    const calendar = getCalendar(params)
    const timeframe = getTimeframe(params)

    // Get the fields of the farm
    let featureCollection: FeatureCollection | undefined
    if (b_id_farm && b_id_farm !== "undefined") {
      const fields = await getFields(fdm, session.principal_id, b_id_farm, timeframe)
      const features = fields.map((field) => {
        const feature = {
          type: "Feature" as const,
          properties: {
            b_id: field.b_id,
            b_name: field.b_name,
            b_area: Math.round((field.b_area ?? 0) * 10) / 10,
            b_lu_name: (field as { b_lu_name?: string }).b_lu_name ?? "",
            b_id_source: field.b_id_source,
          },
          geometry: simplify(field.b_geometry as Geometry, {
            tolerance: 0.00001,
            highQuality: true,
          }),
        }
        return feature
      })

      featureCollection = {
        type: "FeatureCollection",
        features: features,
      }
    }

    // Get Map Style
    const mapStyle = getMapStyle("satellite")

    // Return user information from loader
    return {
      calendar: calendar,
      savedFields: featureCollection,
      mapStyle: mapStyle,
    }
  } catch (error) {
    throw handleLoaderError(error)
  }
}

/**
 * Renders a Maplibre map displaying farm fields with interactive controls.
 *
 * This component consumes preloaded farm field data to compute the map's view state and stylize the field boundaries.
 * It integrates geolocation and navigation controls, wraps the field layer in a non-interactive source, and includes a panel for displaying additional field details on hover.
 */
export default function FarmAtlasFieldsBlock() {
  const loaderData = useLoaderData<typeof loader>()
  const params = useParams()
  const navigate = useNavigate()
  const { capture } = useAnalytics()

  useEffect(() => {
    capture("atlas_viewed", {
      b_id_farm: params.b_id_farm,
      calendar: loaderData.calendar,
      layer: "fields",
    })
  }, [])

  const id = "fieldsSaved"
  const fields = loaderData.savedFields
  const fieldsSavedStyle = getFieldsStyle(id)
  const fieldsAvailableId = "fieldsAvailable"
  const fieldsAvailableStyle = getFieldsStyle(fieldsAvailableId)
  const fieldsSavedOutlineStyle = getFieldsStyle("fieldsSavedOutline")
  // ViewState logic
  const initialViewState = getViewState(fields)

  const [showFields, setShowFields] = useState(true)

  const layerLayout = { visibility: showFields ? "visible" : "none" } as const
  const fieldsAvailableLayer = {
    ...fieldsAvailableStyle,
    layout: layerLayout,
  } as LayerProps
  const fieldsSavedOutlineLayer = {
    ...fieldsSavedOutlineStyle,
    layout: layerLayout,
  } as LayerProps
  const fieldsSavedLayer = {
    ...fieldsSavedStyle,
    layout: layerLayout,
  } as LayerProps

  return (
    <Atlas interactive={true} interactiveLayerIds={[fieldsSavedLayer.id ?? "", fieldsAvailableId]}>
      <Controls
        showFields={showFields}
        onToggleFields={() => setShowFields(!showFields)}
        showFlyToFields={fields && fields.features.length > 0 ? true : undefined}
        initialViewState={initialViewState}
      />

      <MapTilerAttribution />

      <FieldsSourceAvailable
        id={fieldsAvailableId}
        calendar={loaderData.calendar}
        zoomLevelFields={ZOOM_LEVEL_FIELDS}
        redirectToDetailsPage={false}
      >
        <Layer {...fieldsAvailableLayer} />
      </FieldsSourceAvailable>

      {fields && (
        <FieldsSourceNotClickable id={id} fieldsData={fields}>
          <Layer {...fieldsSavedOutlineLayer} />
          <Layer {...fieldsSavedLayer} />
        </FieldsSourceNotClickable>
      )}

      <FieldTooltip
        zoomLevelFields={ZOOM_LEVEL_FIELDS}
        layer={[fieldsAvailableId, id]}
        clickRedirectsToDetailsPage={true}
        onFeatureClicked={(clickedFeature) => {
          const featureCentroid = centroid(clickedFeature)
          const featureCentroidCoordinates = featureCentroid.geometry.coordinates.join(",")
          void navigate(featureCentroidCoordinates)
        }}
      />
    </Atlas>
  )
}
