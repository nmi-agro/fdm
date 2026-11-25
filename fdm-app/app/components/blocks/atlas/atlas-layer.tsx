import { LucideMap } from "lucide-react"
import { ControlPosition } from "maplibre-gl"
import { useMemo } from "react"
import { useMatches, useNavigate, useParams, useRouteLoaderData } from "react-router"
import type { loader as farmLoader } from "~/routes/farm"
import { DropdownMenuCheckedRadioItem } from "~/components/custom/dropdown-menu"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { useCalendarStore } from "~/store/calendar"
import { AtlasControlGroup, AtlasControls } from "./atlas-controls"

const mapLayers = [
  "fields",
  "soil-analysis",
  "nutrient-advice",
  "grazing",
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
  /** The layer is greyed out, with an explanation, until the farm has a herd. */
  requiresHerds?: boolean
  url: (params: Record<string, string | undefined>) => string | null
}

/** Why a layer that needs a herd is greyed out. */
export const ATLAS_LAYER_REQUIRES_HERDS = "Voeg eerst een koppel toe bij Melkvee"

function getCalendarWithFallback(params: Record<string, string | undefined>) {
  return params.calendar ?? useCalendarStore.getState().calendar
}

const mapLayerConfig: Record<MapLayer, AtlasLayerConfig> = {
  fields: {
    context: "farm",
    routeId: "routes/farm.$b_id_farm.$calendar.atlas.fields._index",
    nameNL: "Gewaspercelen",
    requiresFarm: false,
    url(params) {
      const calendar = getCalendarWithFallback(params)
      return uri`/farm/${params.b_id_farm ?? FARM_NOT_SELECTED_ID}/${calendar}/atlas/fields`
    },
  },
  soil: {
    context: "farm",
    routeId: "routes/farm.$b_id_farm.$calendar.atlas.soil",
    nameNL: "Bodemkaart",
    requiresFarm: false,
    url(params) {
      const calendar = getCalendarWithFallback(params)
      return uri`/farm/${params.b_id_farm ?? FARM_NOT_SELECTED_ID}/${calendar}/atlas/soil`
    },
  },
  elevation: {
    context: "farm",
    routeId: "routes/farm.$b_id_farm.$calendar.atlas.elevation",
    nameNL: "Hoogtekaart",
    requiresFarm: false,
    url(params) {
      const calendar = getCalendarWithFallback(params)
      return uri`/farm/${params.b_id_farm ?? FARM_NOT_SELECTED_ID}/${calendar}/atlas/elevation`
    },
  },
  "soil-analysis": {
    context: "farm",
    routeId: "routes/farm.$b_id_farm.$calendar.atlas.soil-analysis._index",
    nameNL: "Bodemanalyses",
    requiresFarm: true,
    url(params) {
      const calendar = getCalendarWithFallback(params)
      return uri`/farm/${params.b_id_farm ?? FARM_NOT_SELECTED_ID}/${calendar}/atlas/soil-analysis`
    },
  },
  "nutrient-advice": {
    context: "farm",
    routeId: "routes/farm.$b_id_farm.$calendar.atlas.nutrient-advice._index",
    nameNL: "Bemestingsadvies",
    // The advice is calculated per field of a farm, so the layer is hidden without a farm.
    requiresFarm: true,
    url(params) {
      const calendar = getCalendarWithFallback(params)
      return uri`/farm/${params.b_id_farm ?? FARM_NOT_SELECTED_ID}/${calendar}/atlas/nutrient-advice`
    },
  },
  grazing: {
    context: "farm",
    routeId: "routes/farm.$b_id_farm.$calendar.atlas.grazing",
    nameNL: "Beweiding",
    requiresFarm: true,
    requiresHerds: true,
    url(params) {
      const calendar = getCalendarWithFallback(params)
      return uri`/farm/${params.b_id_farm ?? FARM_NOT_SELECTED_ID}/${calendar}/atlas/grazing`
    },
  },
  indicators: {
    context: "farm",
    routeId: "routes/farm.$b_id_farm.$calendar.atlas.indicators",
    nameNL: "Indicatoren",
    requiresFarm: true,
    url(params) {
      const calendar = getCalendarWithFallback(params)
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
      const calendar = getCalendarWithFallback(params)
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
  /** `true` when the layer is shown greyed out and cannot be opened yet. */
  disabled: boolean
  /** Why the layer is greyed out, shown next to it. */
  disabledReason?: string
  config: AtlasLayerConfig
}
export function useAvailableAtlasLayers(assumeFarm?: boolean): AvailableAtlasLayerInfo[] {
  const params = useParams()
  const storedCalendar = useCalendarStore((store) => store.calendar)
  const b_id_farm = params.b_id_farm
  const slug = params.slug
  const calendar = params.calendar ?? storedCalendar
  // Whether the selected farm has a herd, from the loader of the /farm layout
  const hasHerds = useRouteLoaderData<typeof farmLoader>("routes/farm")?.hasHerds ?? false

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
        // Without a selected farm the herds are unknown; the farm picker comes first then
        const hasFarm = Boolean(b_id_farm) && b_id_farm !== FARM_NOT_SELECTED_ID
        const disabled = Boolean(config.requiresHerds) && hasFarm && !hasHerds
        availableLayers.push({
          value: layerId,
          label: config[labelKey],
          url: url,
          requiresFarm: config.requiresFarm,
          disabled,
          disabledReason: disabled ? ATLAS_LAYER_REQUIRES_HERDS : undefined,
          config: config,
        })
      }
    }
    return availableLayers
  }, [b_id_farm, slug, calendar, assumeFarm, hasHerds])
}

/** Name of a layer in a menu, with the reason underneath when it is greyed out. */
export function AtlasLayerLabel({ info }: { info: AvailableAtlasLayerInfo }) {
  if (!info.disabled) return <span>{info.label}</span>
  return (
    <span className="flex flex-col">
      <span>{info.label}</span>
      <span className="text-muted-foreground text-xs">{info.disabledReason}</span>
    </span>
  )
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
              disabled={item.disabled}
              onClick={() => {
                const selectedOpt = layerOptions.find((opt) => opt.value === item.value)
                if (selectedOpt && !selectedOpt.disabled) {
                  void navigate(selectedOpt.url)
                }
              }}
            >
              <AtlasLayerLabel info={item} />
            </DropdownMenuCheckedRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
