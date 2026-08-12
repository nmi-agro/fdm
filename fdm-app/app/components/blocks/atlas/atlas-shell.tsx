import maplibregl from "maplibre-gl"
import {
  createContext,
  Ref,
  RefObject,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"
import { Map as MapGL, ViewStateChangeEvent, MapRef, MapProps } from "react-map-gl/maplibre"
import { getMapStyle } from "@/app/integrations/map"
import { useStableSet } from "./atlas-util"
import { AtlasViewState } from "./atlas-viewstate"

/**
 * Context that holds a reference to the wrapper div around the MapGL map, that is used to position the
 * tooltips and other map overlays not native to maplibregl.
 */
const MapContainerContext = createContext<RefObject<HTMLDivElement | null>>({ current: null })

/**
 * Gets a ref to the wrapper div around the MapGL map, that is used to position the
 * tooltips and other map overlays not native to maplibregl.
 * @returns a reference to a <div> element.
 */
export function useMapContainer() {
  return useContext(MapContainerContext)
}

/**
 * The controlling state for the map position, orientation, and tilt.
 */
const ViewStateContext = createContext<[AtlasViewState, (viewState: AtlasViewState) => void]>([
  {},
  () => {},
])

/**
 * Gets the controlling state for the map position, orientation, and tilt, and its setter.
 * @returns an array of the current view state, and the setter function.
 */
export function useAtlasViewState() {
  return useContext(ViewStateContext)
}

/**
 * Displays a `react-mapgl` map and handles the standard navigation controls.
 *
 * It can be composed with different atlas panels and atlas sources in order to display the desired data.
 */
export function Atlas(
  props: MapProps & {
    ref?: Ref<MapRef>
    initialViewState?: AtlasViewState
    interactive?: boolean
    children?: any
  },
) {
  const {
    ref,
    initialViewState,
    interactive,
    interactiveLayerIds,
    children,
    style,
    ...mapGlProps
  } = props
  const mapRef = useRef<MapRef>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const mapStyle = getMapStyle("satellite")

  const interactiveLayerIdsSet = useStableSet(interactiveLayerIds)

  const viewStateContext = useState<AtlasViewState>(() => {
    if (typeof window !== "undefined") {
      try {
        const savedViewState = sessionStorage.getItem("mapViewState")
        if (savedViewState) {
          return JSON.parse(savedViewState)
        }
      } catch {
        // ignore storage errors (e.g., private mode)
      }
    }
    return initialViewState
  })

  const [viewState, setViewState] = viewStateContext

  useEffect(() => {
    if (interactive && typeof window !== "undefined") {
      try {
        sessionStorage.setItem("mapViewState", JSON.stringify(viewState))
      } catch {
        // ignore storage errors (e.g., private mode)
      }
    }
  }, [interactive, viewState])

  const onMouseMove = useCallback(
    (e: maplibregl.MapLayerMouseEvent) => {
      if (mapRef.current) {
        mapRef.current.getCanvas().style.cursor =
          interactiveLayerIdsSet.size > 0 &&
          e.features?.some((x) => interactiveLayerIdsSet.has(x.layer.id))
            ? "pointer"
            : interactive
              ? "grab"
              : ""
      }
    },
    [interactive, interactiveLayerIdsSet],
  )

  const onMouseLeave = useCallback(() => {
    if (mapRef.current) {
      mapRef.current.getCanvas().style.cursor = interactive ? "grab" : ""
    }
  }, [interactive])

  const onViewportChange = useCallback(
    (event: ViewStateChangeEvent) => {
      setViewState(event.viewState)
    },
    [setViewState],
  )

  return (
    <div
      className="relative overflow-hidden"
      style={{
        height: "calc(100vh - 64px)",
        width: "100%",
        ...style,
      }}
      ref={containerRef}
    >
      <MapContainerContext.Provider value={containerRef}>
        <ViewStateContext.Provider value={viewStateContext}>
          <MapGL
            {...viewState}
            {...mapGlProps}
            style={{ width: "100%", height: "100%" }}
            ref={(map) => {
              if (ref) {
                if (typeof ref === "function") {
                  ref(map)
                } else {
                  ref.current = map
                }
              }
              mapRef.current = map
            }}
            interactive={interactive}
            interactiveLayerIds={interactiveLayerIds}
            mapStyle={mapStyle}
            mapLib={maplibregl}
            onMove={(e) => {
              onViewportChange(e)
              mapGlProps.onMove?.(e)
            }}
            onMouseMove={(e) => {
              onMouseMove(e)
              mapGlProps.onMouseMove?.(e)
            }}
            onMouseLeave={(e) => {
              onMouseLeave()
              mapGlProps.onMouseLeave?.(e)
            }}
          >
            {children}
          </MapGL>
        </ViewStateContext.Provider>
      </MapContainerContext.Provider>
    </div>
  )
}
