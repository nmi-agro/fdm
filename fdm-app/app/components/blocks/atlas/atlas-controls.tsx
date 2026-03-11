import { Layers, Mountain, PanelsRightBottom, Scan } from "lucide-react"
import type { ControlPosition, IControl, Map as MapLibreMap } from "maplibre-gl"
import { type ReactNode, useEffect, useMemo, useState } from "react"
import { createRoot, type Root } from "react-dom/client"
import {
    GeolocateControl,
    NavigationControl,
    useControl,
} from "react-map-gl/maplibre"
import { useIsMobile } from "~/hooks/use-mobile"
import { GeocoderControl } from "./atlas-geocoder"

type ControlsProps = {
    onViewportChange: (viewport: {
        longitude: number
        latitude: number
        zoom: number
    }) => void
    showFields?: boolean
    onToggleFields?: () => void
    showElevation?: boolean
    onToggleElevation?: () => void
    showSoil?: boolean
    onToggleSoil?: () => void
    showFlyToFields?: boolean
    onFlyToFields?: () => void
}

/**
 * Show different atlas buttons and toggles as required according to the props
 *
 * To hide a button you can pass undefined to the corresponding `show...` or just not provide the corresponding `on...` callback.
 */
export function Controls(props: ControlsProps) {
    const isMobile = useIsMobile()
    return (
        <>
            <GeocoderControl
                onViewportChange={props.onViewportChange}
                collapsed={isMobile}
            />
            <AtlasControls position="top-right">
                {props.showFields !== undefined && props.onToggleFields && (
                    <FieldsControl
                        showFields={props.showFields}
                        onToggle={props.onToggleFields}
                    />
                )}
                {props.showElevation !== undefined &&
                    props.onToggleElevation && (
                        <ElevationControl
                            showElevation={props.showElevation}
                            onToggle={props.onToggleElevation}
                        />
                    )}
                {props.showSoil !== undefined && props.onToggleSoil && (
                    <SoilControl
                        showSoil={props.showSoil}
                        onToggle={props.onToggleSoil}
                    />
                )}
                {props.showFlyToFields !== undefined && props.onFlyToFields && (
                    <FlyToFieldsControl onClick={props.onFlyToFields} />
                )}
            </AtlasControls>
            <GeolocateControl
                positionOptions={{ enableHighAccuracy: true }}
                trackUserLocation={true}
            />
            <NavigationControl />
        </>
    )
}

interface AtlasControlsProps {
    position: ControlPosition
    children: ReactNode
}

/**
 * MapGL control that is compatible with `useControl` that maintains a ReactDOM root and renders it whenever its props change
 */
class CustomControl implements IControl {
    _map: MapLibreMap | undefined
    _container: HTMLDivElement | undefined
    _root: Root | undefined
    _props: AtlasControlsProps

    constructor(initialProps: AtlasControlsProps) {
        this._props = initialProps
    }

    onAdd(map: MapLibreMap): HTMLElement {
        this._map = map
        this._container = document.createElement("div")

        this._root = createRoot(this._container)
        this._render()

        return this._container
    }

    onRemove(): void {
        if (this._root) {
            const root = this._root
            setTimeout(() => {
                root.unmount()
            }, 0)
            this._root = undefined
        }
        this._container?.parentNode?.removeChild(this._container)
        this._container = undefined
        this._map = undefined
    }

    getDefaultPosition(): ControlPosition {
        return "top-right"
    }

    updateProps(newProps: AtlasControlsProps) {
        this._props = newProps
        this._render()
    }

    _render() {
        if (this._root) {
            this._root.render(this._props.children)
        }
    }
}

/**
 * React root that can be added to a react-map-gl Map to include buttons etc. on it
 *
 * - position will tell MapGL where to put the controls
 */
export function AtlasControls(props: AtlasControlsProps) {
    const control = useControl(() => new CustomControl(props), {
        position: props.position,
    })

    useEffect(() => control.updateProps(props), [props, control])

    // Buttons are shown using side effects
    return null
}

interface CommonButtonProps {
    active?: boolean
    label?: string
    Icon: React.ElementType
}

interface ButtonProps extends CommonButtonProps {
    onClick?: () => void
}

interface ToggleProps extends CommonButtonProps {
    labelInactive?: string
    labelActive?: string
    onToggle?: () => void
}

// Functional components
/**
 * Renders a button with possibly a visual active state.
 *
 * This in itself doesn't have a rounded button background so should be used as a child of AtlasControlGroup.
 */
function AtlasButton({ active = true, ...props }: ButtonProps) {
    return (
        <button
            className="maplibregl-ctrl-icon flex items-center justify-center p-0!"
            type="button"
            title={props.label}
            aria-label={props.label}
            onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                if (props.onClick) props.onClick()
            }}
        >
            <props.Icon
                className={`h-5 w-full ${active ? "opacity-100" : "opacity-40"}`}
            />
        </button>
    )
}

/**
 * Renders a toggle button whose active state can be controlled.
 *
 * This in itself doesn't have a rounded button background so should be used as a child of AtlasControlGroup.
 */
function AtlasToggle(props: ToggleProps) {
    const [activeState, setActiveState] = useState(true)
    const active = props.active ?? activeState
    const onToggleFn = useMemo(
        () =>
            props.onToggle ??
            (() => {
                setActiveState((state) => !state)
            }),
        [props.onToggle],
    )
    const specificLabel = active ? props.labelActive : props.labelInactive
    return (
        <AtlasButton
            {...props}
            active={active}
            onClick={onToggleFn}
            label={specificLabel ?? props.label}
        />
    )
}

/**
 * Displays a rounded button background.
 *
 * Multiple AtlasButtons and AtlasToggles can be added as children to create button groups.
 */
function AtlasControlGroup({ children }: { children: ReactNode }) {
    return (
        <div className="maplibregl-ctrl maplibregl-ctrl-group">{children}</div>
    )
}

// Stylistic components
/**
 * Complete clickable button with a rounded button background
 */
export function SingleAtlasButton(props: ButtonProps) {
    return (
        <AtlasControlGroup>
            <AtlasButton {...props} />
        </AtlasControlGroup>
    )
}

/**
 * Complete clickable toggle button with a rounded button background whose active state can be controlled.
 */
export function SingleAtlasToggle(props: ToggleProps) {
    return (
        <AtlasControlGroup>
            <AtlasToggle {...props} />
        </AtlasControlGroup>
    )
}

// FDM components
/**
 * Specialized toggle button to show or hide the selected/saved fields layer.
 */
function FieldsControl({
    showFields,
    onToggle,
}: {
    showFields: boolean
    onToggle: () => void
}) {
    return (
        <SingleAtlasToggle
            active={showFields}
            onToggle={onToggle}
            labelActive="Verberg percelen"
            labelInactive="Toon percelen"
            Icon={PanelsRightBottom}
        />
    )
}

/**
 * Specialized button to have the map focus on the selected and/or saved fields.
 */
function FlyToFieldsControl({ onClick }: { onClick: () => void }) {
    return (
        <SingleAtlasButton
            onClick={onClick}
            label="Vliegen naar percelen"
            Icon={Scan}
        />
    )
}

/**
 * Specialized toggle button to show or hide the elevation map layer.
 */
function ElevationControl({
    showElevation,
    onToggle,
}: {
    showElevation: boolean
    onToggle: () => void
}) {
    return (
        <SingleAtlasToggle
            active={showElevation}
            onToggle={onToggle}
            labelActive="Verberg hoogtekaart"
            labelInactive="Toon hoogtekaart"
            Icon={Mountain}
        />
    )
}

/**
 * Specialized toggle button to show or hide the soil type map layer.
 */
function SoilControl({
    showSoil,
    onToggle,
}: {
    showSoil: boolean
    onToggle: () => void
}) {
    return (
        <SingleAtlasToggle
            active={showSoil}
            onToggle={onToggle}
            labelActive="Verberg bodemkaart"
            labelInactive="Toon bodemkaart"
            Icon={Layers}
        />
    )
}
