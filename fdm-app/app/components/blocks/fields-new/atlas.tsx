import maplibregl from "maplibre-gl"
import { useEffect, useRef, useState } from "react"
import { Layer, Map as MapGL, type MapRef } from "react-map-gl/maplibre"
import { Skeleton } from "../../ui/skeleton"
import { MapTilerAttribution } from "../atlas/atlas-attribution"
import { FieldsSourceNotClickable } from "../atlas/atlas-sources"
import { getFieldsStyle } from "../atlas/atlas-styles"
import { getViewState } from "../atlas/atlas-viewstate"

export function NewFieldsAtlas({
    featureCollection,
    mapStyle,
}: NewFieldsAtlasProps) {
    const viewState = getViewState(featureCollection)
    const id = "fieldsSaved"
    const fields = featureCollection
    const fieldsSavedStyle = getFieldsStyle(id)
    const fieldsSavedOutlineStyle = getFieldsStyle("fieldsSavedOutline")

    //ref to refit the map when the selected field changes
    const mapRef = useRef<MapRef>(null)

    useEffect(() => {
        mapRef.current?.fitBounds(viewState.bounds, viewState.fitBoundsOptions)
    }, [viewState])

    //ref to check if map is rendered
    const mapContainerRef = useRef<HTMLDivElement>(null)
    const [mapIsLoaded, setMapIsLoaded] = useState(false)

    useEffect(() => {
        if (mapContainerRef.current) {
            setMapIsLoaded(true)
        }
    }, [])

    return (
        <div ref={mapContainerRef} className="h-full w-full">
            {mapIsLoaded ? (
                <MapGL
                    {...viewState}
                    style={{
                        height: "100%",
                        width: "100%",
                        borderRadius: "0.75rem",
                    }}
                    interactive={false}
                    mapStyle={mapStyle}
                    mapLib={maplibregl}
                    interactiveLayerIds={[id]}
                    ref={mapRef}
                >
                    <MapTilerAttribution />
                    <FieldsSourceNotClickable id={id} fieldsData={fields}>
                        <Layer {...fieldsSavedStyle} />
                        <Layer {...fieldsSavedOutlineStyle} />
                    </FieldsSourceNotClickable>
                </MapGL>
            ) : (
                <Skeleton className="h-full w-full rounded-xl" />
            )}
        </div>
    )
}

type NewFieldsAtlasProps = {
    featureCollection: GeoJSON.FeatureCollection
    mapStyle: string | maplibregl.StyleSpecification
}
