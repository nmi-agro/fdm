import type { Layer } from "@deck.gl/core"
import { MapboxOverlay } from "@deck.gl/mapbox"
import { useControl } from "react-map-gl/maplibre"

interface DeckGLOverlayProps {
    layers: Layer[]
    interleaved?: boolean
}

export function DeckGLOverlay(props: DeckGLOverlayProps) {
    if (typeof window === "undefined") return null
    const overlay = useControl<MapboxOverlay>(() => new MapboxOverlay(props))
    overlay.setProps(props)
    return null
}
