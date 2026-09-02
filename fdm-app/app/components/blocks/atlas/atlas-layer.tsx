import { LucideMap } from "lucide-react"
import { ControlPosition } from "maplibre-gl"
import { useMemo } from "react"
import { useMatches, useNavigate, useParams } from "react-router"
import { getCalendarSelection } from "@/app/lib/calendar"
import { DropdownMenuCheckedRadioItem } from "~/components/custom/dropdown-menu"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { AtlasControlGroup, AtlasControls } from "./atlas-controls"

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
export type AtlasLayerConfig = {
  context: "farm" | "organization"
  routeId: string
  nameNL: string
  requiresFarm: boolean
  url: (params: Record<string, string | undefined>) => string | null
}

const mapLayerConfig: Record<MapLayer, AtlasLayerConfig> = {
  fields: {
    context: "farm",
    routeId: "routes/farm.$b_id_farm.$calendar.atlas.fields._index",
    nameNL: "Gewaspercelen",
    requiresFarm: false,
    url(params) {
      const calendar = params.calendar ?? getCalendarSelection()[0]
      return uri`/farm/${params.b_id_farm ?? FARM_NOT_SELECTED_ID}/${calendar}/atlas/fields`
    },
  },
  soil: {
    context: "farm",
    routeId: "routes/farm.$b_id_farm.$calendar.atlas.soil",
    nameNL: "Bodemkaart",
    requiresFarm: false,
    url(params) {
      const calendar = params.calendar ?? getCalendarSelection()[0]
      return uri`/farm/${params.b_id_farm ?? FARM_NOT_SELECTED_ID}/${calendar}/atlas/soil`
    },
  },
  elevation: {
    context: "farm",
    routeId: "routes/farm.$b_id_farm.$calendar.atlas.elevation",
    nameNL: "Hoogtekaart",
    requiresFarm: false,
    url(params) {
      const calendar = params.calendar ?? getCalendarSelection()[0]
      return uri`/farm/${params.b_id_farm ?? FARM_NOT_SELECTED_ID}/${calendar}/atlas/elevation`
    },
  },
  "soil-analysis": {
    context: "farm",
    routeId: "routes/farm.$b_id_farm.$calendar.atlas.soil-analysis._index",
    nameNL: "Bodemanalyses",
    requiresFarm: true,
    url(params) {
      const calendar = params.calendar ?? getCalendarSelection()[0]
      return uri`/farm/${params.b_id_farm ?? FARM_NOT_SELECTED_ID}/${calendar}/atlas/soil-analysis`
    },
  },
  indicators: {
    context: "farm",
    routeId: "routes/farm.$b_id_farm.$calendar.atlas.indicators",
    nameNL: "Indicatoren",
    requiresFarm: true,
    url(params) {
      const calendar = params.calendar ?? getCalendarSelection()[0]
      return uri`/farm/${params.b_id_farm ?? FARM_NOT_SELECTED_ID}/${calendar}/atlas/indicators`
    },
  },
  "organization-indicators": {
    context: "organization",
    routeId: "routes/organization.$slug.$calendar.atlas.indicators",
    nameNL: "Indicatoren",
    requiresFarm: false,
    url(params) {
      if (!params.slug) return null
      const calendar = params.calendar ?? getCalendarSelection()[0]
      return uri`/organization/${params.slug}/${calendar}/atlas/indicators`
    },
  },
}

const mapLayerByRouteId = Object.fromEntries(
  Object.entries(mapLayerConfig).map(([k, { routeId }]) => [routeId, k]),
) as Record<string, MapLayer>

function uri(stringParts: TemplateStringsArray, ...substitutions: string[]) {
  return substitutions.reduce(
    (prev, cur, i) => prev + encodeURIComponent(cur) + stringParts[i + 1],
    stringParts[0],
  )
}

export function useCurrentAtlasLayer() {
  const matches = useMatches()

  let currentLayer: MapLayer | null = null

  for (const match of matches) {
    const layer = mapLayerByRouteId[match.id]
    if (layer) {
      currentLayer = layer
      break
    }
  }

  return currentLayer
}

export type AvailableAtlasLayerInfo = {
  value: string
  label: string
  url: string
  requiresFarm: boolean
  config: AtlasLayerConfig
}
export function useAvailableAtlasLayers(assumeFarm?: boolean): AvailableAtlasLayerInfo[] {
  const params = useParams()
  const b_id_farm = params.b_id_farm
  const slug = params.slug
  const calendar = params.calendar

  return useMemo(() => {
    const context = slug ? "organization" : "farm"
    const labelKey = "nameNL"
    const availableLayers: AvailableAtlasLayerInfo[] = []
    for (const layerId of mapLayers) {
      const config = mapLayerConfig[layerId]
      if (config.context !== context) continue
      if (!assumeFarm && (!b_id_farm || b_id_farm === FARM_NOT_SELECTED_ID) && config.requiresFarm)
        continue
      const url = config.url({
        calendar: calendar,
        b_id_farm: b_id_farm,
        slug: slug,
      })
      if (url) {
        availableLayers.push({
          value: layerId,
          label: config[labelKey],
          url: url,
          requiresFarm: config.requiresFarm,
          config: config,
        })
      }
    }
    return availableLayers
  }, [b_id_farm, slug, calendar, assumeFarm])
}

/**
 * Atlas control that detects which atlas this is from the current route id and allows switching to
 * a different atlas route for the same farm/organization.
 */
export function AtlasLayerSwitch({ position }: { position: ControlPosition }) {
  const currentLayer = useCurrentAtlasLayer()

  return (
    <AtlasControls position={position}>
      {currentLayer ? <AtlasLayerSwitchInner currentLayer={currentLayer} /> : null}
    </AtlasControls>
  )
}

/**
 * Dropdown menu that can be displayed on the atlas, providing atlas page options that are able to be
 * navigated to with the current route parameters.
 */
function AtlasLayerSwitchInner({ currentLayer }: { currentLayer: MapLayer }) {
  const navigate = useNavigate()
  const layerOptions = useAvailableAtlasLayers()

  if (layerOptions.length < 2) return null

  return (
    <DropdownMenu>
      <AtlasControlGroup>
        <DropdownMenuTrigger
          className="maplibregl-ctrl-icon flex items-center justify-center p-0!"
          type="button"
          title="Kies een andere kaart"
          aria-label="Kies een andere kaart"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
        >
          <LucideMap className="h-5 w-full" />
        </DropdownMenuTrigger>
      </AtlasControlGroup>
      <DropdownMenuContent>
        <DropdownMenuRadioGroup value={currentLayer}>
          {layerOptions.map((item) => (
            <DropdownMenuCheckedRadioItem
              key={item.value}
              value={item.value}
              onClick={() => {
                const selectedOpt = layerOptions.find((opt) => opt.value === item.value)
                if (selectedOpt) {
                  void navigate(selectedOpt.url)
                }
              }}
            >
              {item.label}
            </DropdownMenuCheckedRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
