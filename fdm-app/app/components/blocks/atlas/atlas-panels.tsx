import type { FeatureCollection } from "geojson"
import throttle from "lodash.throttle"
import { Check, Info } from "lucide-react"
import type { MapGeoJSONFeature, MapLibreZoomEvent } from "maplibre-gl"
import { useCallback, useEffect, useState } from "react"
import type { MapLayerMouseEvent as MapMouseEvent } from "react-map-gl/maplibre"
import { useMap } from "react-map-gl/maplibre"
import { data, NavLink, useFetcher } from "react-router"
import { getCultivationColor } from "~/components/custom/cultivation-colors"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import { Spinner } from "~/components/ui/spinner"
import { cn } from "~/lib/utils"

export function FieldsPanelHover({
    zoomLevelFields,
    layer,
    layerExclude,
    clickRedirectsToDetailsPage = false,
}: {
    zoomLevelFields: number
    layer: string[] | string
    layerExclude?: string[] | string
    clickRedirectsToDetailsPage?: boolean
}) {
    const { current: map } = useMap()
    const [panel, setPanel] = useState<React.ReactNode | null>(null)
    useEffect(() => {
        function updatePanel(evt: MapMouseEvent | MapLibreZoomEvent) {
            if (map) {
                // Set message about zoom level
                const zoom = map.getZoom()
                if (zoom && zoom > zoomLevelFields) {
                    if (!map.getStyle()) return
                    const layers = Array.isArray(layer) ? layer : [layer]
                    const validLayers = layers.filter((l) => map.getLayer(l))
                    if (validLayers.length === 0) return
                    const features = map.queryRenderedFeatures(evt.point, {
                        layers: validLayers,
                    })
                    // Layer, whose id is specified last in the layer prop, has the highest priority
                    features.sort(
                        (f1, f2) =>
                            validLayers.indexOf(f2.layer.id) -
                            validLayers.indexOf(f1.layer.id),
                    )

                    if (layerExclude) {
                        const layers = Array.isArray(layerExclude)
                            ? layerExclude
                            : [layerExclude]
                        const validLayers = layers.filter((l) =>
                            map.getLayer(l),
                        )

                        if (validLayers.length > 0) {
                            const featuresExclude = map.queryRenderedFeatures(
                                evt.point,
                                {
                                    layers: validLayers,
                                },
                            )
                            if (featuresExclude && featuresExclude.length > 0) {
                                setPanel(makePanel({}))
                                return
                            }
                        }
                    }

                    if (
                        features &&
                        features.length > 0 &&
                        features[0].properties
                    ) {
                        setPanel(
                            makePanel({
                                layer: features[0].layer.id,
                                feature: features[0],
                            }),
                        )
                    } else {
                        setPanel(makePanel({}))
                    }

                    function makePanel({
                        layer,
                        feature,
                    }: {
                        layer?: string
                        feature?: MapGeoJSONFeature
                    }) {
                        const active = layer && feature
                        const name = feature
                            ? layer === "fieldsSaved"
                                ? features[0].properties.b_name
                                : features[0].properties.b_lu_name
                            : "Naam"
                        return (
                            <Card
                                className={cn("w-full", !active && "invisible")}
                            >
                                <CardHeader>
                                    <CardTitle>{name}</CardTitle>
                                    <CardDescription>
                                        {layer === "fieldsSaved"
                                            ? `${features[0].properties.b_area} ha`
                                            : clickRedirectsToDetailsPage
                                              ? "Klik voor meer details over dit perceel"
                                              : layer === "fieldsAvailable"
                                                ? "Klik om te selecteren"
                                                : "Klik om te verwijderen"}
                                    </CardDescription>
                                </CardHeader>
                            </Card>
                        )
                    }
                }
            }
        }

        // Throttle panel updates to not overwhelm React, the rendering thread etc.
        const throttleInterval = 200
        const throttledUpdatePanelInner = throttle(
            updatePanel,
            throttleInterval,
            {
                trailing: true,
            },
        )

        // Delay handling of clicks so that if the field selection under the mouse changes we catch it
        let delayedUpdateTimeout: ReturnType<typeof setTimeout>
        const delayedUpdatePanel: typeof updatePanel = (e) => {
            delayedUpdateTimeout = setTimeout(
                () => throttledUpdatePanelInner(e),
                throttleInterval,
            )
        }

        // Cancels any timed out invocations and tries to invoke again
        const throttledUpdatePanel: typeof updatePanel = (e) => {
            clearTimeout(delayedUpdateTimeout)
            throttledUpdatePanelInner(e)
        }

        if (map) {
            map.on("mousemove", throttledUpdatePanel)
            map.on("mousedown", delayedUpdatePanel)
            map.on("click", updatePanel)
            map.on("zoom", throttledUpdatePanel)
            map.on("load", updatePanel)
            return () => {
                map.off("mousemove", throttledUpdatePanel)
                map.off("mousedown", delayedUpdatePanel)
                map.off("click", updatePanel)
                map.off("zoom", throttledUpdatePanel)
                map.off("load", updatePanel)
            }
        }
    }, [map, zoomLevelFields, layer, layerExclude, clickRedirectsToDetailsPage])

    return panel
}

export function FieldsPanelZoom({
    zoomLevelFields,
}: {
    zoomLevelFields: number
}) {
    const { current: map } = useMap()
    const [panel, setPanel] = useState<React.ReactNode | null>(null)

    useEffect(() => {
        function updatePanel() {
            if (map) {
                // Set message about zoom level
                const zoom = map.getZoom()
                if (zoom && zoom <= zoomLevelFields) {
                    setPanel(
                        <Alert>
                            <Info className="h-4 w-4" />
                            <AlertTitle>Let op!</AlertTitle>
                            <AlertDescription>
                                Zoom in om percelen te kunnen selecteren.
                            </AlertDescription>
                        </Alert>,
                    )
                } else {
                    setPanel(null)
                }
            }
        }

        const throttledUpdatePanel = throttle(updatePanel, 250, {
            trailing: true,
        })

        if (map) {
            map.on("move", throttledUpdatePanel)
            map.on("zoom", throttledUpdatePanel)
            map.once("load", throttledUpdatePanel)
            return () => {
                map.off("move", throttledUpdatePanel)
                map.off("zoom", throttledUpdatePanel)
            }
        }
    }, [map, zoomLevelFields])

    return panel
}

export function FieldsPanelSelection({
    fields,
    numFieldsSaved,
    continueTo,
}: {
    fields: FeatureCollection
    numFieldsSaved: number
    continueTo: string
}) {
    const fetcher = useFetcher()
    const { current: map } = useMap()
    const [panel, setPanel] = useState<React.ReactNode | null>(null)

    const isSubmitting = fetcher.state !== "idle"

    const submitSelectedFields = useCallback(
        async (fields: FeatureCollection) => {
            if (fields.features.length === 0) return
            try {
                const formSelectedFields = new FormData()
                formSelectedFields.append(
                    "selected_fields",
                    JSON.stringify(fields),
                )

                await fetcher.submit(formSelectedFields, {
                    method: "POST",
                })
            } catch (error: unknown) {
                console.error("Failed to submit fields: ", error)
                throw data({
                    status: 500,
                    statusText: `Failed to submit fields: ${error}`,
                })
                // TODO: adding a toast notification with error
            }
        },
        [fetcher],
    )

    useEffect(() => {
        function updatePanel() {
            if (map) {
                // Set information about fields
                const features = fields?.features || []
                if (features.length > 0) {
                    // console.log(fields.features)

                    const fieldCount = features.length
                    let fieldCountText = `Je hebt ${fieldCount} percelen geselecteerd`
                    if (fieldCount === 1) {
                        fieldCountText = "Je hebt 1 perceel geselecteerd"
                    }

                    const cultivations = features.reduce(
                        (
                            acc: {
                                b_lu_name: string
                                b_lu_croprotation?: string
                                count: number
                            }[],
                            feature,
                        ) => {
                            if (!feature.properties) return acc
                            const existingCultivation = acc.find(
                                (c) =>
                                    c.b_lu_name ===
                                    feature.properties.b_lu_name,
                            )
                            if (existingCultivation) {
                                existingCultivation.count++
                            } else {
                                acc.push({
                                    b_lu_name: feature.properties.b_lu_name,
                                    b_lu_croprotation:
                                        feature.properties.b_lu_croprotation,
                                    count: 1,
                                })
                            }
                            return acc
                        },
                        [],
                    )

                    setPanel(
                        <Card className="w-full flex-initial min-h-0 flex flex-col gap-4">
                            <CardHeader>
                                <CardTitle>Percelen</CardTitle>
                                <CardDescription>
                                    {fieldCountText}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex-initial min-h-0 overflow-y-scroll">
                                <div className="space-y-4">
                                    {cultivations.map((cultivation, _index) => (
                                        // let cultivationCountText = `${cultivation.count + 1} percelen`

                                        <div
                                            key={cultivation.b_lu_name}
                                            className="grid grid-cols-[25px_1fr] items-start"
                                        >
                                            <span
                                                className="flex h-2 w-2 translate-y-1 rounded-full"
                                                style={{
                                                    backgroundColor:
                                                        getCultivationColor(
                                                            cultivation.b_lu_croprotation,
                                                        ),
                                                }}
                                            />
                                            <div className="space-y-1">
                                                <p className="text-sm font-medium leading-none">
                                                    {cultivation.b_lu_name}
                                                </p>
                                                <p className="text-sm text-muted-foreground">
                                                    {`${cultivation.count} percelen`}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                            <CardFooter>
                                <Button
                                    onClick={() => submitSelectedFields(fields)}
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? (
                                        <div className="flex items-center space-x-2">
                                            <Spinner />
                                            <span>
                                                Opslaan van geselecteerde
                                                percelen...
                                            </span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center space-x-2">
                                            <Check />
                                            <span>
                                                Sla geselecteerde percelen op
                                            </span>
                                        </div>
                                    )}
                                </Button>
                            </CardFooter>
                        </Card>,
                    )
                } else {
                    setPanel(
                        <Card>
                            <CardHeader>
                                <CardTitle>Percelen</CardTitle>
                                <CardDescription>
                                    {numFieldsSaved > 0
                                        ? "Je hebt geen nieuwe percelen geselecteerd"
                                        : "Je hebt geen percelen geselecteerd"}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-4" />
                            <CardFooter>
                                {numFieldsSaved > 0 ? (
                                    <Button asChild className="w-full">
                                        <NavLink
                                            to={continueTo}
                                            className="flex items-center gap-2"
                                        >
                                            <Check />
                                            <span>Doorgaan</span>
                                        </NavLink>
                                    </Button>
                                ) : (
                                    <Button className="w-full" disabled>
                                        <Check /> Sla geselecteerde percelen op
                                    </Button>
                                )}
                            </CardFooter>
                        </Card>,
                    )
                }
            }
        }
        updatePanel()
    }, [
        fields,
        isSubmitting,
        map,
        submitSelectedFields,
        continueTo,
        numFieldsSaved,
    ])

    return panel
}
