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
import { Map as MapGL, ViewStateChangeEvent, MapRef, MapCallbacks } from "react-map-gl/maplibre"
import { getMapStyle } from "@/app/integrations/map"
import { AtlasViewState } from "./atlas-viewstate"

/** Context to get the outer */
const MapContainerContext = createContext<RefObject<HTMLDivElement | null>>({ current: null })
export function useMapContainer() {
  return useContext(MapContainerContext)
}

const ViewStateContext = createContext<[AtlasViewState, (viewState: AtlasViewState) => void]>([
  {},
  () => {},
])
export function useAtlasViewState() {
  return useContext(ViewStateContext)
}

/**
 * Displays a `react-mapgl` map and handles the standard navigation controls.
 *
 * It can be composed with different atlas panels and atlas sources in order to display the desired data.
 */
export function Atlas(
  props: MapCallbacks & {
    ref?: Ref<MapRef>
    initialViewState?: AtlasViewState
    interactive?: boolean
    children?: any
  },
) {
  const { ref, initialViewState, interactive, children, ...mapGlProps } = props
  const containerRef = useRef<HTMLDivElement>(null)

  const mapStyle = getMapStyle("satellite")

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
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem("mapViewState", JSON.stringify(viewState))
      } catch {
        // ignore storage errors (e.g., private mode)
      }
    }
  }, [viewState])

  const onViewportChange = useCallback((event: ViewStateChangeEvent) => {
    setViewState(event.viewState)
  }, [])

  return (
    <div className="relative h-full w-full overflow-hidden" ref={containerRef}>
      <MapContainerContext.Provider value={containerRef}>
        <ViewStateContext.Provider value={viewStateContext}>
          <MapGL
            {...viewState}
            ref={ref}
            style={{ height: "calc(100vh - 64px)", width: "100%" }}
            interactive={interactive}
            mapStyle={mapStyle}
            mapLib={maplibregl}
            onMove={onViewportChange}
            {...mapGlProps}
          >
            {children}
          </MapGL>
        </ViewStateContext.Provider>
      </MapContainerContext.Provider>
    </div>
  )
}
