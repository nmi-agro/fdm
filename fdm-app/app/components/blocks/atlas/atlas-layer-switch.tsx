import { ControlPosition } from "maplibre-gl"
import { useMemo } from "react"
import { useMatches, useNavigate, useParams } from "react-router"
import { getCalendarSelection } from "@/app/lib/calendar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select"
import { AtlasControls } from "./atlas-controls"

const mapLayers = [
  "fields",
  "soil-analysis",
  "elevation",
  "soil",
  "indicators",
  "organization-indicators",
] as const
type MapLayer = (typeof mapLayers)[number]

const FARM_NOT_SELECTED_ID = "undefined"
const mapLayerInfo: Record<
  MapLayer,
  {
    context: "farm" | "organization"
    routeId: string
    nameNL: string
    url: (params: Record<string, string | undefined>) => string | null
  }
> = {
  fields: {
    context: "farm",
    routeId: "routes/farm.$b_id_farm.$calendar.atlas.fields._index",
    nameNL: "Gewaspercelen",
    url(params) {
      const calendar = params.calendar ?? getCalendarSelection()[0]
      return uri`/farm/${params.b_id_farm ?? FARM_NOT_SELECTED_ID}/${calendar}/atlas/fields`
    },
  },
  soil: {
    context: "farm",
    routeId: "routes/farm.$b_id_farm.$calendar.atlas.soil",
    nameNL: "Bodemkaart",
    url(params) {
      const calendar = params.calendar ?? getCalendarSelection()[0]
      return uri`/farm/${params.b_id_farm ?? FARM_NOT_SELECTED_ID}/${calendar}/atlas/soil`
    },
  },
  elevation: {
    context: "farm",
    routeId: "routes/farm.$b_id_farm.$calendar.atlas.elevation",
    nameNL: "Hoogtekaart",
    url(params) {
      const calendar = params.calendar ?? getCalendarSelection()[0]
      return uri`/farm/${params.b_id_farm ?? FARM_NOT_SELECTED_ID}/${calendar}/atlas/elevation`
    },
  },
  "soil-analysis": {
    context: "farm",
    routeId: "routes/farm.$b_id_farm.$calendar.atlas.soil-analysis._index",
    nameNL: "Bodemanalyses",
    url(params) {
      if (!params.b_id_farm || params.b_id_farm === FARM_NOT_SELECTED_ID) return null
      const calendar = params.calendar ?? getCalendarSelection()[0]
      return uri`/farm/${params.b_id_farm}/${calendar}/atlas/soil`
    },
  },
  indicators: {
    context: "farm",
    routeId: "routes/farm.$b_id_farm.$calendar.atlas.indicators",
    nameNL: "Indicatoren",
    url(params) {
      if (!params.b_id_farm || params.b_id_farm === FARM_NOT_SELECTED_ID) return null
      const calendar = params.calendar ?? getCalendarSelection()[0]
      return uri`/farm/${params.b_id_farm}/${calendar}/atlas/indicators`
    },
  },
  "organization-indicators": {
    context: "organization",
    routeId: "routes/organization.$slug.$calendar.atlas.indicators",
    nameNL: "Indicatoren",
    url(params) {
      if (!params.slug) return null
      const calendar = params.calendar ?? getCalendarSelection()[0]
      return uri`/organization/${params.slug}/${calendar}/atlas/indicators`
    },
  },
}

const mapLayerByRouteId = Object.fromEntries(
  Object.entries(mapLayerInfo).map(([k, { routeId }]) => [routeId, k]),
) as Record<string, MapLayer>

function uri(stringParts: TemplateStringsArray, ...substitutions: string[]) {
  return substitutions.reduce(
    (prev, cur, i) => prev + encodeURIComponent(cur) + stringParts[i + 1],
    stringParts[0],
  )
}

/**
 * Atlas control that detects which atlas this is from the current route id and allows switching to
 * a different atlas route for the same farm/organization.
 */
export function AtlasLayerSwitch({ position }: { position: ControlPosition }) {
  const matches = useMatches()
  const params = useParams()
  const navigate = useNavigate()

  let currentLayer: MapLayer | null = null

  for (const match of matches) {
    const layer = mapLayerByRouteId[match.id]
    if (layer) {
      currentLayer = layer
      break
    }
  }

  return (
    <AtlasControls position={position}>
      {currentLayer ? (
        <AtlasLayerSwitchInner currentLayer={currentLayer} params={params} navigate={navigate} />
      ) : null}
    </AtlasControls>
  )
}

/**
 * Dropdown menu that can be displayed on the atlas, providing atlas page options that are able to be
 * navigated to with the given route parameters.
 *
 * It takes the relevant React Router functions as props since this component does not have access to
 * the React Router hooks at where it is used.
 */
function AtlasLayerSwitchInner({
  currentLayer,
  params,
  navigate,
}: {
  currentLayer: MapLayer
  params: Record<string, string | undefined>
  navigate: ReturnType<typeof useNavigate>
}) {
  // This component does not have access to React Router hooks since it is rendered inside a separate
  // ReactDOM root.

  const layerOptions = useMemo(() => {
    const context = params.slug ? "organization" : "farm"
    const labelKey = "nameNL"
    const availableLayers: { value: string; label: string; url: string }[] = []
    for (const layerId of mapLayers) {
      if (mapLayerInfo[layerId].context !== context) continue
      const url = mapLayerInfo[layerId].url({
        calendar: params.calendar,
        b_id_farm: params.b_id_farm,
        slug: params.slug,
      })
      if (url) {
        availableLayers.push({ value: layerId, label: mapLayerInfo[layerId][labelKey], url: url })
      }
    }
    return availableLayers
  }, [params.calendar, params.b_id_farm, params.slug])

  if (layerOptions.length < 2) return null

  return (
    <div
      ref={(element) => {
        if (element) {
          element.onpointerup = (e) => {
            e.stopPropagation()
          }
        }
      }}
      className="maplibregl-ctrl maplibregl-ctrl-geocoder"
      style={{ width: "auto", minWidth: "0px", maxWidth: "200px" }}
    >
      <Select
        value={currentLayer}
        onValueChange={(value) => {
          const selectedOpt = layerOptions.find((opt) => opt.value === value)
          if (selectedOpt) {
            navigate(selectedOpt.url)
          }
        }}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {layerOptions.map((x) => (
            <SelectItem key={x.value} value={x.value}>
              {x.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
