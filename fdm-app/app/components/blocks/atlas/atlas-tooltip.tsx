import { cva } from "class-variance-authority"
import throttle from "lodash.throttle"
import { X } from "lucide-react"
import maplibregl from "maplibre-gl"
import { ReactNode, useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useMap, MapRef } from "react-map-gl/maplibre"
import { cn } from "@/app/lib/utils"
import { Button } from "~/components/ui/button"
import { Card } from "~/components/ui/card"
import { useMapContainer } from "./atlas-shell"
import { useStableSet } from "./atlas-util"

type AtlasTooltipRenderProps = {
  feature: maplibregl.MapGeoJSONFeature | null
  mode: "popup" | "tooltip"
  latitude: number
  longitude: number
}

/**
 * A `Card` wrapper that places itself onto the map. It follows the mouse or moves to where the user tapped
 * with their finger. When its position changes it determines the rendered map feature under it, and the
 * feature is passed to the `render` function.
 */
export function AtlasTooltip({
  render,
  layers,
  layersExclude,
  onFeatureClicked,
  touchDisplaysPopupInstead = true,
}: {
  render: (props: AtlasTooltipRenderProps) => ReactNode
  layers: string[]
  layersExclude?: string[]
  onFeatureClicked?: (feature: maplibregl.MapGeoJSONFeature) => void
  touchDisplaysPopupInstead?: boolean
}) {
  const { current: map } = useMap()
  const { current: mapContainer } = useMapContainer()

  const layersSet = useStableSet(layers)
  const layersExcludeSet = useStableSet(layersExclude)

  type HoverPosition = {
    mode: "tooltip" | "popup"
    x: number
    y: number
    lngLat: maplibregl.LngLat
  }
  const [hoverPosition, setHoverPosition] = useState<HoverPosition | null>(null)
  const hoverPositionRef = useRef<HoverPosition | null>(null)
  const [hoveredFeature, setHoveredFeature] = useState<maplibregl.MapGeoJSONFeature | null>(null)

  const getHoveredFeature = useCallback(
    (map: MapRef, x: number, y: number) => {
      const coords = new maplibregl.Point(x, y)

      if (layersExcludeSet.size > 0) {
        const excludedFeatures = map.queryRenderedFeatures(coords, {
          layers: [...layersExcludeSet],
        })

        if (excludedFeatures.length > 0) {
          return null
        }
      }

      const features = map.queryRenderedFeatures(coords, {
        layers: [...layersSet],
      })

      return features.length > 0 ? features[0] : null
    },
    [map, map?.style, layersSet, layersExcludeSet],
  )

  const updateHoveredFeatureThrottled = useCallback(
    // Throttle to reduce visual flashing
    throttle(
      () => {
        const currentHoverPosition = hoverPositionRef.current
        if (map && currentHoverPosition) {
          const position =
            currentHoverPosition.mode === "tooltip"
              ? currentHoverPosition
              : map.project(currentHoverPosition.lngLat)
          setHoveredFeature(getHoveredFeature(map, position.x, position.y))
        } else {
          setHoveredFeature(null)
        }
      },
      200,
      { trailing: true },
    ),
    [map, getHoveredFeature],
  )

  useEffect(() => {
    const currentMap = map
    const currentMapContainer = mapContainer

    if (!currentMap || !currentMapContainer) return

    const onZoom = () => {
      if (!hoverPosition) return
      updateHoveredFeatureThrottled()
    }

    const pointers = new Map<number, { startX: number; startY: number; moved: boolean }>()

    // Reset a pointer's start position when it is put down (important for the mouse)
    const onPointerDown = (e: PointerEvent) => {
      const info = { startX: e.clientX, startY: e.clientY, moved: false }
      pointers.set(e.pointerId, info)
    }

    const onPointerMove = (e: PointerEvent) => {
      // Make sure this pointer is tracked
      let info = pointers.get(e.pointerId)

      if (!info) {
        info = { startX: e.clientX, startY: e.clientY, moved: false }
        pointers.set(e.pointerId, info)
      }

      // Distinguish between taps and drags
      if (!info.moved && Math.abs(e.clientX - info.startX) + Math.abs(e.clientY - info.startY)) {
        info.moved = true
      }

      // Show hover tooltip for mouse and pen
      if (e.pointerType !== "touch") {
        const bcr = currentMapContainer.getBoundingClientRect()
        const x = e.clientX - bcr.left
        const y = e.clientY - bcr.top
        const newHoverPosition = {
          mode: "tooltip" as const,
          x: x,
          y: y,
          lngLat: currentMap.unproject(new maplibregl.Point(x, y)),
        }
        hoverPositionRef.current = newHoverPosition
        setHoverPosition(newHoverPosition)
        updateHoveredFeatureThrottled()
      }
    }

    const onPointerUp = (e: PointerEvent) => {
      const info = pointers.get(e.pointerId)

      if (info && !info.moved) {
        const bcr = currentMapContainer.getBoundingClientRect()
        const x = e.clientX - bcr.left
        const y = e.clientY - bcr.top
        if (e.pointerType === "touch" && touchDisplaysPopupInstead) {
          const newHoverPosition = {
            mode: "popup" as const,
            x: x,
            y: y,
            lngLat: currentMap.unproject(new maplibregl.Point(x, y)),
          }
          hoverPositionRef.current = newHoverPosition
          setHoverPosition(newHoverPosition)
          updateHoveredFeatureThrottled()
        } else if (onFeatureClicked) {
          const clickedFeature = getHoveredFeature(currentMap, x, y)
          if (clickedFeature) {
            onFeatureClicked(clickedFeature)
          }
        }
      }

      pointers.delete(e.pointerId)
    }

    const onPointerLeave = (e: PointerEvent) => {
      if (hoverPositionRef.current?.mode === "tooltip") {
        hoverPositionRef.current = null
        setHoverPosition(null)
        setHoveredFeature(null)
      }
      pointers.delete(e.pointerId)
    }

    currentMap.on("zoom", onZoom)
    currentMapContainer.addEventListener("pointerdown", onPointerDown)
    currentMapContainer.addEventListener("pointermove", onPointerMove)
    currentMapContainer.addEventListener("pointerup", onPointerUp)
    currentMapContainer.addEventListener("pointerleave", onPointerLeave)

    return () => {
      currentMap.off("zoom", onZoom)
      currentMapContainer.removeEventListener("pointerdown", onPointerDown)
      currentMapContainer.removeEventListener("pointermove", onPointerMove)
      currentMapContainer.removeEventListener("pointerup", onPointerUp)
      currentMapContainer.removeEventListener("pointerleave", onPointerLeave)
    }
  }, [getHoveredFeature, map, mapContainer])

  if (!mapContainer) return

  if (hoverPosition?.mode === "popup") {
    return createPortal(
      <AtlasPopup longitude={hoverPosition.lngLat.lng} latitude={hoverPosition.lngLat.lat}>
        <Button
          type="button"
          variant="ghost"
          className="has-[>svg]:p-1 absolute right-2 top-2"
          title="Sluiten"
          aria-label="Sluiten"
          onClick={() => {
            setHoverPosition(null)
            setHoveredFeature(null)
            hoverPositionRef.current = null
          }}
        >
          <X />
        </Button>
        {render({
          feature: hoveredFeature,
          mode: "popup",
          longitude: hoverPosition.lngLat.lng,
          latitude: hoverPosition.lngLat.lat,
        })}
      </AtlasPopup>,
      mapContainer,
    )
  }

  if (hoverPosition) {
    return createPortal(
      <AtlasTooltipContent x={hoverPosition.x} y={hoverPosition.y} interactive={false}>
        {render({
          feature: hoveredFeature,
          mode: "tooltip",
          longitude: hoverPosition.lngLat.lng,
          latitude: hoverPosition.lngLat.lat,
        })}
      </AtlasTooltipContent>,
      mapContainer,
    )
  }
}

const AnchorPositioning = cva("", {
  variants: {
    anchorX: {
      left: "",
      center: "-translate-x-1/2",
      right: "-translate-x-full",
    },
    anchorY: {
      top: "",
      center: "-translate-y-1/2",
      bottom: "-translate-y-full",
    },
  },
  defaultVariants: {
    anchorX: "center",
    anchorY: "bottom",
  },
})

/**
 * A component that places a `AtlasTooltipContent` at the given longitude and latitude.
 */
function AtlasPopup({
  longitude,
  latitude,
  children,
}: {
  longitude: number
  latitude: number
  children: ReactNode
}) {
  const { current: map } = useMap()
  if (!map) return null

  const [x, setX] = useState(0)
  const [y, setY] = useState(0)

  useEffect(() => {
    const onViewportChange = () => {
      const screenPoint = map.project([longitude, latitude])
      setX(screenPoint.x)
      setY(screenPoint.y)
    }

    onViewportChange() // initial position

    ;["move", "zoom", "rotate"].forEach((evt) => {
      map.on(evt, onViewportChange)
    })
    return () => {
      ;["move", "zoom", "rotate"].forEach((evt) => {
        map.off(evt, onViewportChange)
      })
    }
  }, [map, longitude, latitude])

  return <AtlasTooltipContent x={x} y={y} children={children} />
}

/**
 * A `Card` wrapper that has a speech bubble tip. The tip is moved based on the distance to the edges of the
 * relative container.
 */
function AtlasTooltipContent({
  x,
  y,
  interactive = true,
  children,
}: {
  x: number
  y: number
  interactive?: boolean
  children: ReactNode
}) {
  const { current: mapContainer } = useMapContainer()
  const tooltipContainerRef = useRef<HTMLDivElement>(null)
  const [anchorX, setAnchorX] = useState<"left" | "center" | "right">("center")
  const [anchorY, setAnchorY] = useState<"top" | "center" | "bottom">("bottom")

  useEffect(() => {
    if (!mapContainer) {
      setAnchorX("center")
      setAnchorY("bottom")
      return
    }
    const bcr = mapContainer.getBoundingClientRect()
    const anchorX = x < bcr.width / 3 ? "left" : x > (bcr.width * 2) / 3 ? "right" : "center"
    const anchorY = y < bcr.height / 3 ? "top" : y > (bcr.height * 2) / 3 ? "bottom" : "center"
    if (anchorX === "center" && anchorY === "center") {
      setAnchorX("center")
      setAnchorY("bottom")
    } else {
      setAnchorX(anchorX)
      setAnchorY(anchorY)
    }
  }, [mapContainer, x, y])

  useEffect(() => {
    const el = tooltipContainerRef.current
    if (!el || !interactive) return
    const stop = (e: PointerEvent) => {
      e.stopPropagation()
    }
    el.addEventListener("pointerdown", stop)
    el.addEventListener("pointermove", stop)
    el.addEventListener("pointerup", stop)
    return () => {
      el.removeEventListener("pointerdown", stop)
      el.removeEventListener("pointermove", stop)
      el.removeEventListener("pointerup", stop)
    }
  }, [interactive])

  if (children === null || children === undefined) {
    return null
  }

  return (
    <div
      ref={tooltipContainerRef}
      className={cn(
        "flex absolute cursor-default",
        !interactive && "pointer-events-none",
        anchorY !== "center" && "flex-col",
        AnchorPositioning({ anchorX, anchorY }),
      )}
      style={{
        left: `${x}px`,
        top: `${y}px`,
      }}
    >
      {anchorX === "left" && anchorY === "top" && (
        <div className="size-0 border-transparent border-l-card border-x-6 border-y-8 border-b-0 self-start" />
      )}
      {anchorX === "right" && anchorY === "top" && (
        <div className="size-0 border-transparent border-r-card border-x-6 border-y-8 border-b-0 self-end" />
      )}
      {anchorX === "center" && anchorY === "top" && (
        <div className="size-0 border-transparent border-b-card border-8 border-t-0 self-center" />
      )}
      {anchorX === "left" && anchorY === "center" && (
        <div className="size-0 border-transparent border-r-card border-8 border-l-0 self-center" />
      )}
      <Card
        className={cn(
          "border-0 relative",
          anchorX === "left" && anchorY === "top" && "rounded-tl-none",
          anchorX === "right" && anchorY === "top" && "rounded-tr-none",
          anchorX === "left" && anchorY === "bottom" && "rounded-bl-none",
          anchorX === "right" && anchorY === "bottom" && "rounded-br-none",
        )}
      >
        {children}
      </Card>
      {anchorX === "right" && anchorY === "center" && (
        <div className="size-0 border-transparent border-l-card border-8 border-r-0 self-center" />
      )}
      {anchorX === "left" && anchorY === "bottom" && (
        <div className="size-0 border-transparent border-l-card border-x-6 border-y-8 border-t-0 self-start" />
      )}
      {anchorX === "right" && anchorY === "bottom" && (
        <div className="size-0 border-transparent border-r-card border-x-6 border-y-8 border-t-0 self-end" />
      )}
      {anchorX === "center" && anchorY === "bottom" && (
        <div className="size-0 border-transparent border-t-card border-8 border-b-0 self-center" />
      )}
    </div>
  )
}
