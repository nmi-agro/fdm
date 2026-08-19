import throttle from "lodash.throttle"
import { X } from "lucide-react"
import { Point, MapGeoJSONFeature, LngLat, Popup as MapPopup } from "maplibre-gl"
import { ComponentProps, ReactNode, useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useMap, MapRef } from "react-map-gl/maplibre"
import { cn } from "@/app/lib/utils"
import { Button } from "~/components/ui/button"
import { Card, CardHeader, CardContent, CardFooter } from "~/components/ui/card"
import { useMapContainer } from "./atlas-shell"
import { useStableSet } from "./atlas-util"

type AtlasTooltipRenderProps = {
  features: MapGeoJSONFeature[]
  mode: "popup" | "tooltip"
  latitude: number
  longitude: number
}

/**
 * Minimum distance in pixels from the initial position that would cause the touch action to be interpreted
 * as a drag instead of a tap.
 */
const TOUCH_DRAG_TOLERANCE = 8

/**
 * A tooltip that either follows the mouse pointer or appears as a popup at the touch position. When its
 * position changes it determines the rendered map features under it, then passes the array of features to the
 * render function. If the render function returns null or undefined, nothing is rendered at all, including
 * the tooltip speech bubble.
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
  onFeatureClicked?: (feature: MapGeoJSONFeature) => void
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
    lngLat: LngLat
  }
  const [hoverPosition, setHoverPosition] = useState<HoverPosition | null>(null)
  const hoverPositionRef = useRef<HoverPosition | null>(null)
  const [hoveredFeatures, setHoveredFeatures] = useState<MapGeoJSONFeature[]>([])

  const getHoveredFeatures = useCallback(
    (map: MapRef, x: number, y: number) => {
      const coords = new Point(x, y)

      if (layersExcludeSet.size > 0) {
        const excludedFeatures = map.queryRenderedFeatures(coords, {
          layers: [...layersExcludeSet],
        })

        if (excludedFeatures.length > 0) {
          return []
        }
      }

      const features = map.queryRenderedFeatures(coords, {
        layers: [...layersSet],
      })

      return features
    },
    [map, layersSet, layersExcludeSet],
  )

  // Throttle tooltip updates to reduce flashing.
  const [updateHoveredFeatureThrottled, setUpdateHoveredFeatureThrottled] = useState(() => () => {})
  useEffect(() => {
    const fn = throttle(
      () => {
        const currentHoverPosition = hoverPositionRef.current
        if (map && currentHoverPosition) {
          const position =
            currentHoverPosition.mode === "tooltip"
              ? currentHoverPosition
              : map.project(currentHoverPosition.lngLat)
          setHoveredFeatures(getHoveredFeatures(map, position.x, position.y))
        } else {
          setHoveredFeatures([])
        }
      },
      200,
      { trailing: true },
    )

    setUpdateHoveredFeatureThrottled(() => fn)

    return () => {
      fn.cancel()
    }
  }, [map, getHoveredFeatures])

  // When the user clicks on the map or the popup, the feature under the hover position needs to be updated
  // in case the map layers change.
  const updateHoveredFeaturesOnceIdle = useCallback(() => {
    if (!map) return
    map.once("idle", () => {
      const pos = hoverPositionRef.current
      if (!pos) return
      const position = pos.mode === "tooltip" ? pos : map.project(pos.lngLat)
      setHoveredFeatures(getHoveredFeatures(map, position.x, position.y))
    })
  }, [map, getHoveredFeatures])

  // Attach event listeners to the map that adjust the tooltip position and handle clicks.
  useEffect(() => {
    const currentMap = map
    const currentMapContainer = mapContainer

    if (!currentMap || !currentMapContainer) return

    const onZoom = () => {
      if (!hoverPositionRef.current) return
      updateHoveredFeatureThrottled()
    }

    const pointers = new Map<
      number,
      { startX: number; startY: number; moved: boolean; out: boolean }
    >()

    // Reset a pointer's start position when it is put down (important for the mouse)
    const onPointerDown = (e: PointerEvent) => {
      const info = { startX: e.clientX, startY: e.clientY, moved: false, out: false }
      pointers.set(e.pointerId, info)
    }

    const onPointerMove = (e: PointerEvent) => {
      // Make sure this pointer is tracked
      let info = pointers.get(e.pointerId)

      if (!info) {
        info = { startX: e.clientX, startY: e.clientY, moved: false, out: false }
        pointers.set(e.pointerId, info)
      }

      // Distinguish between taps and drags
      if (
        !info.moved &&
        Math.abs(e.clientX - info.startX) + Math.abs(e.clientY - info.startY) > TOUCH_DRAG_TOLERANCE
      ) {
        info.moved = true
      }

      // Show hover tooltip for mouse and pen
      if (e.pointerType !== "touch") {
        if (info.out) {
          hoverPositionRef.current = null
          setHoverPosition(null)
          setHoveredFeatures([])
        } else {
          const bcr = currentMapContainer.getBoundingClientRect()
          const x = e.clientX - bcr.left
          const y = e.clientY - bcr.top
          const newHoverPosition = {
            mode: "tooltip" as const,
            x: x,
            y: y,
            lngLat: currentMap.unproject(new Point(x, y)),
          }
          hoverPositionRef.current = newHoverPosition
          setHoverPosition(newHoverPosition)
          updateHoveredFeatureThrottled()
        }
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
            lngLat: currentMap.unproject(new Point(x, y)),
          }
          hoverPositionRef.current = newHoverPosition
          setHoverPosition(newHoverPosition)
          updateHoveredFeatureThrottled()
        } else {
          if (onFeatureClicked) {
            const clickedFeatures = getHoveredFeatures(currentMap, x, y)
            if (clickedFeatures.length > 0) {
              onFeatureClicked(clickedFeatures[0])
            }
          }
          // Always schedule a re-query after a click, feature state may change in response.
          updateHoveredFeaturesOnceIdle()
        }
      }

      pointers.delete(e.pointerId)
    }

    const onPointerLeave = (e: PointerEvent) => {
      if (hoverPositionRef.current?.mode === "tooltip") {
        hoverPositionRef.current = null
        setHoverPosition(null)
        setHoveredFeatures([])
      }
      pointers.delete(e.pointerId)
    }

    const onPointerOver = (e: PointerEvent) => {
      if (e.pointerType === "touch") return
      const info = pointers.get(e.pointerId)
      if (info) {
        info.out = e.target !== map.getCanvas()
      }
      onPointerMove(e)
    }

    // ESC key to dismiss the popup
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && hoverPositionRef.current?.mode === "popup") {
        hoverPositionRef.current = null
        setHoverPosition(null)
        setHoveredFeatures([])
      }
    }

    currentMap.on("zoom", onZoom)
    currentMapContainer.addEventListener("pointerdown", onPointerDown)
    currentMapContainer.addEventListener("pointermove", onPointerMove)
    currentMapContainer.addEventListener("pointerup", onPointerUp)
    currentMapContainer.addEventListener("pointerleave", onPointerLeave)
    currentMapContainer.addEventListener("pointerover", onPointerOver)
    addEventListener("keydown", onKeyDown)

    return () => {
      currentMap.off("zoom", onZoom)
      currentMapContainer.removeEventListener("pointerdown", onPointerDown)
      currentMapContainer.removeEventListener("pointermove", onPointerMove)
      currentMapContainer.removeEventListener("pointerup", onPointerUp)
      currentMapContainer.removeEventListener("pointerleave", onPointerLeave)
      currentMapContainer.removeEventListener("pointerover", onPointerOver)
      removeEventListener("keydown", onKeyDown)
    }
  }, [
    getHoveredFeatures,
    map,
    mapContainer,
    updateHoveredFeatureThrottled,
    updateHoveredFeaturesOnceIdle,
    touchDisplaysPopupInstead,
    onFeatureClicked,
  ])

  if (!mapContainer) return

  if (hoverPosition?.mode === "popup") {
    return createPortal(
      <AtlasPopup
        longitude={hoverPosition.lngLat.lng}
        latitude={hoverPosition.lngLat.lat}
        onPointerUp={() => {
          // Layers might change after this happens.
          updateHoveredFeaturesOnceIdle()
        }}
      >
        <Button
          type="button"
          variant="ghost"
          className="absolute top-0.5 right-0.5 has-[>svg]:p-1"
          title="Sluiten"
          aria-label="Sluiten"
          onClick={() => {
            setHoverPosition(null)
            setHoveredFeatures([])
            hoverPositionRef.current = null
          }}
        >
          <X />
        </Button>
        {render({
          features: hoveredFeatures,
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
      <AtlasTooltipCard x={hoverPosition.x} y={hoverPosition.y} interactive={false}>
        {render({
          features: hoveredFeatures,
          mode: "tooltip",
          longitude: hoverPosition.lngLat.lng,
          latitude: hoverPosition.lngLat.lat,
        })}
      </AtlasTooltipCard>,
      mapContainer,
    )
  }
}

/**
 * A popup that is displayed at the given latitude and longitude on the map.
 */
export function AtlasPopup({
  longitude,
  latitude,
  className,
  onPointerUp,
  children,
}: {
  longitude: number
  latitude: number
  className?: string
  onPointerUp?: () => void
  children: ReactNode
}) {
  const { current: map } = useMap()
  const popupRef = useRef<MapPopup | null>(null)
  const [container, setContainer] = useState<HTMLDivElement | null>(null)

  // Create the maplibre Popup once when the map is ready and tear it down on unmount.
  useEffect(() => {
    if (!map) return

    const el = document.createElement("div")

    const popup = new MapPopup({
      closeButton: false,
      closeOnClick: false,
      maxWidth: "none",
      className: "atlas-popup",
    })
      .setLngLat([longitude, latitude])
      .setDOMContent(el)
      .addTo(map.getMap())

    popupRef.current = popup
    setContainer(el)

    return () => {
      popup.remove()
      popupRef.current = null
      setContainer(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map])

  // Keep the anchor coordinates in sync without recreating the popup.
  useEffect(() => {
    popupRef.current?.setLngLat([longitude, latitude])
  }, [longitude, latitude])

  if (!container) return null

  return createPortal(
    <AtlasNativePopupCard className={className} onPointerUp={onPointerUp}>
      {children}
    </AtlasNativePopupCard>,
    container,
  )
}

/**
 * Card content for use inside a maplibre-gl Popup.
 */
function AtlasNativePopupCard({
  className,
  onPointerUp,
  children,
}: {
  className?: string
  onPointerUp?: () => void
  children: ReactNode
}) {
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = cardRef.current
    if (!el) return
    const stop = (e: PointerEvent) => e.stopPropagation()
    const myOnPointerUp = (e: PointerEvent) => {
      e.stopPropagation()
      onPointerUp?.()
    }
    el.addEventListener("pointerdown", stop)
    el.addEventListener("pointermove", stop)
    el.addEventListener("pointerup", myOnPointerUp)
    return () => {
      el.removeEventListener("pointerdown", stop)
      el.removeEventListener("pointermove", stop)
      el.removeEventListener("pointerup", myOnPointerUp)
    }
  }, [onPointerUp])

  if (children === null || children === undefined) return null

  return (
    <div ref={cardRef} className={cn("cursor-default", className)}>
      <Card className="maplibregl-popup-native-card relative p-3 text-xs shadow-md">
        {children}
      </Card>
    </div>
  )
}

const TOOLTIP_ANCHOR_X_OFFSET = 12
const TOOLTIP_ANCHOR_Y_OFFSET = 8
/**
 * A `Card` wrapper that has a speech bubble tip. The tip is moved based on the distance to the edges of the
 * relative container.
 */
function AtlasTooltipCard({
  x,
  y,
  interactive = true,
  className,
  children,
}: {
  x: number
  y: number
  interactive?: boolean
  className?: string
  children: ReactNode
}) {
  const { current: mapContainer } = useMapContainer()
  const tooltipContainerRef = useRef<HTMLDivElement>(null)
  const [anchorX, setAnchorX] = useState<"left" | "right">("left")
  const [anchorY, setAnchorY] = useState<"top" | "bottom">("top")

  useEffect(() => {
    if (!mapContainer) {
      setAnchorX("left")
      setAnchorY("top")
      return
    }
    const bcr = mapContainer.getBoundingClientRect()
    const anchorX = x < bcr.width * 0.67 ? "left" : "right"
    const anchorY = y < bcr.height * 0.67 ? "top" : "bottom"
    setAnchorX(anchorX)
    setAnchorY(anchorY)
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
        "absolute max-w-65 min-w-45 cursor-default",
        !interactive && "pointer-events-none",
        className,
      )}
      style={{
        left:
          anchorX === "left"
            ? `${x + TOOLTIP_ANCHOR_X_OFFSET}px`
            : `${x - TOOLTIP_ANCHOR_X_OFFSET}px`,
        top:
          anchorY === "top"
            ? `${y + TOOLTIP_ANCHOR_Y_OFFSET}px`
            : `${y - TOOLTIP_ANCHOR_Y_OFFSET}px`,
        transform:
          anchorX === "right" && anchorY === "bottom"
            ? "translate(-100%,-100%)"
            : anchorX === "right"
              ? "translateX(-100%)"
              : anchorY === "bottom"
                ? "translateY(-100%)"
                : "none",
      }}
    >
      <Card className="relative p-3 text-xs shadow-md">{children}</Card>
    </div>
  )
}

export function AtlasTooltipHeader(props: ComponentProps<typeof CardHeader>) {
  return <CardHeader {...props} className={cn("mb-1.5 p-0 last:mb-0", props.className)} />
}

export function AtlasTooltipContent(props: ComponentProps<typeof CardContent>) {
  return (
    <CardContent
      {...props}
      className={cn("flex items-center justify-between gap-3 border-t p-0 pt-1.5", props.className)}
    />
  )
}

export function AtlasTooltipFooter(props: ComponentProps<typeof CardFooter>) {
  return <CardFooter {...props} className={cn("mt-1.5 p-0", props.className)} />
}
