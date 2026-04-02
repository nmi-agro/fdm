import {
    addCultivation,
    addField,
    addSoilAnalysis,
    getCultivations,
    getDefaultDatesOfCultivation,
    getFarm,
    getFields,
} from "@nmi-agro/fdm-core"
import { featureCollection, simplify } from "@turf/turf"
import type {
    Feature,
    FeatureCollection,
    GeoJsonProperties,
    Geometry,
    Polygon,
} from "geojson"
import maplibregl from "maplibre-gl"
import { useCallback, useRef, useState } from "react"
import {
    Layer,
    Map as MapGL,
    type MapRef,
    type ViewState,
    type ViewStateChangeEvent,
} from "react-map-gl/maplibre"
import {
    type ActionFunctionArgs,
    data,
    type LoaderFunctionArgs,
    type MetaFunction,
    useLoaderData,
} from "react-router"
import { redirectWithSuccess } from "remix-toast"
import { ClientOnly } from "remix-utils/client-only"
import { ZOOM_LEVEL_FIELDS } from "~/components/blocks/atlas/atlas"
import { MapTilerAttribution } from "~/components/blocks/atlas/atlas-attribution"
import { Controls } from "~/components/blocks/atlas/atlas-controls"
import { generateFeatureClass } from "~/components/blocks/atlas/atlas-functions"
import {
    FieldsPanelHover,
    FieldsPanelSelection,
    FieldsPanelZoom,
} from "~/components/blocks/atlas/atlas-panels"
import {
    FieldsSourceAvailable,
    FieldsSourceNotClickable,
    FieldsSourceSelected,
} from "~/components/blocks/atlas/atlas-sources"
import { getFieldsStyle } from "~/components/blocks/atlas/atlas-styles"
import { getViewState } from "~/components/blocks/atlas/atlas-viewstate"
import { Header } from "~/components/blocks/header/base"
import { HeaderFarmCreate } from "~/components/blocks/header/create-farm"
import { Separator } from "~/components/ui/separator"
import { SidebarInset } from "~/components/ui/sidebar"
import { Skeleton } from "~/components/ui/skeleton"
import { getMapStyle } from "~/integrations/map"
import {
    getNmiApiKey,
    getSoilParameterEstimates,
} from "~/integrations/nmi.server"
import { getSession } from "~/lib/auth.server"
import { getCalendar, getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import FieldDetailsInfoPopup from "../components/blocks/field/popup"

// Meta
export const meta: MetaFunction = () => {
    return [
        { title: `Kaart - Bedrijf toevoegen | ${clientConfig.name}` },
        {
            name: "description",
            content:
                "Bekijk en bewerk je percelen op een interactieve kaart. Pas perceelgrenzen aan en bekijk satellietbeelden.",
        },
    ]
}

/**
 * Retrieves farm details and map configurations for rendering the farm map.
 *
 * This loader function extracts the farm ID from route parameters, validates its presence, and uses the current session to fetch the corresponding farm details. It then retrieves the Maplibre token and style configuration, and returns these along with the farm's display name and a URL for available fields. Any errors encountered during processing are transformed using {~link handleLoaderError}.
 *
 * ~throws {Response} When the farm ID is missing, the specified farm is not found, or another error occurs during data retrieval.
 *
 * ~returns An object containing the farm name, Maplibre token, Maplibre style, and the URL for available fields.
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
    try {
        // Get the Id and name of the farm
        const b_id_farm = params.b_id_farm
        if (!b_id_farm) {
            throw data("Farm ID is required", {
                status: 400,
                statusText: "Farm ID is required",
            })
        }

        // Get the session
        const session = await getSession(request)

        // Get the farm
        const farm = await getFarm(fdm, session.principal_id, b_id_farm)
        if (!farm) {
            throw data("Farm not found", {
                status: 404,
                statusText: "Farm not found",
            })
        }

        // Get calendar and timeframe from calendar store
        const calendar = getCalendar(params)
        const timeframe = getTimeframe(params)

        // Get the fields of the farm in case the farmer came back after creating some fields
        const fields = await getFields(
            fdm,
            session.principal_id,
            b_id_farm,
            timeframe,
        )
        const features = await Promise.all(
            fields.map(async (field) => {
                // Get field cultivation if available or get the first cultivation created by the farmer
                let cultivation = field.b_lu_name
                if (!cultivation) {
                    try {
                        const cultivations = await getCultivations(
                            fdm,
                            session.principal_id,
                            field.b_id,
                            timeframe,
                        )

                        if (cultivations.length > 0) {
                            cultivation = cultivations[0].b_lu_name
                        } else {
                            cultivation = "geen gewassen"
                        }
                    } catch (e) {
                        console.warn(e)
                        cultivation = "gewassen onbekend"
                    }
                }

                const feature: Feature = {
                    type: "Feature" as const,
                    properties: {
                        b_id: field.b_id,
                        b_name: field.b_name,
                        b_area: Math.round(field.b_area * 10) / 10,
                        b_lu_name: cultivation,
                        b_id_source: field.b_id_source,
                    },
                    geometry: simplify(field.b_geometry as Geometry, {
                        tolerance: 0.00001,
                        highQuality: true,
                    }),
                }
                return feature
            }),
        )

        const fieldsSaved: FeatureCollection = {
            type: "FeatureCollection",
            features: features,
        }

        // Get Map Style
        const mapStyle = getMapStyle("satellite")

        return {
            b_id_farm: farm.b_id_farm,
            b_name_farm: farm.b_name_farm,
            fieldsSaved: fieldsSaved,
            timeframe: timeframe,
            calendar: calendar,
            mapStyle: mapStyle,
            continueTo: `/farm/create/${b_id_farm}/${calendar}/fields`,
        }
    } catch (error) {
        throw handleLoaderError(error)
    }
}

// Main
export default function Index() {
    const loaderData = useLoaderData<typeof loader>()

    const fieldsAvailableId = "fieldsAvailable"
    // const fields = loaderData.savedFields
    const initialViewState = getViewState(loaderData.fieldsSaved)
    const fieldsAvailableStyle = getFieldsStyle(fieldsAvailableId)

    const [viewState, setViewState] = useState<ViewState>(
        initialViewState as ViewState,
    )

    const onViewportChange = useCallback((event: ViewStateChangeEvent) => {
        setViewState(event.viewState)
    }, [])

    const [open, setOpen] = useState(false)

    const [selectedField, setSelectedField] = useState<Feature<Polygon> | null>(
        null,
    )

    const handleClickSavedField = async (feature: Feature<Polygon>) => {
        setSelectedField(feature)
        setOpen(true)
    }

    const fieldsSelectedId = "fieldsSelected"
    const fieldsSelectedStyle = getFieldsStyle(fieldsSelectedId)

    const fieldsSavedId = "fieldsSaved"
    const fieldsSaved = loaderData.fieldsSaved
    const fieldsSavedStyle = getFieldsStyle(fieldsSavedId)

    const fieldsSavedOutlineStyle = getFieldsStyle("fieldsSavedOutline")

    // Set selected fields
    const [selectedFieldsData, setSelectedFieldsData] = useState(
        generateFeatureClass(),
    )

    const [showFields, setShowFields] = useState(true)
    const layerLayout = { visibility: showFields ? "visible" : "none" } as const

    const mapRef = useRef<MapRef>(null)

    return (
        <SidebarInset>
            <Header action={undefined}>
                <HeaderFarmCreate b_name_farm={loaderData.b_name_farm} />
            </Header>
            <main>
                <div className="space-y-6 p-10 pb-0">
                    <div className="flex items-center">
                        <div className="space-y-0.5">
                            <h2 className="text-2xl font-bold tracking-tight">
                                Kaart
                            </h2>
                            <p className="text-muted-foreground">
                                Zoom in en selecteer je percelen
                            </p>
                        </div>

                        <div className="ml-auto">
                            {/* <a href={`/farm/create/${loaderData.b_id_farm}/cultivations`} className="ml-auto">
                <Button>Doorgaan</Button>
              </a> */}
                        </div>
                    </div>
                    <Separator className="my-6" />
                </div>
                <div>
                    <ClientOnly
                        fallback={
                            <Skeleton className="h-full w-full rounded-xl" />
                        }
                    >
                        {() => (
                            <MapGL
                                {...viewState}
                                ref={mapRef}
                                style={{
                                    height: "calc(100vh - 64px - 147px)",
                                    width: "100%",
                                }}
                                interactive={true}
                                mapStyle={loaderData.mapStyle}
                                mapLib={maplibregl}
                                interactiveLayerIds={[
                                    fieldsAvailableId,
                                    fieldsSelectedId,
                                    fieldsSavedId,
                                ]}
                                onMove={onViewportChange}
                                onClick={(evt) => {
                                    if (!evt.features) return
                                    const polygonFeature = evt.features.find(
                                        (f) =>
                                            f.source === fieldsSavedId &&
                                            f.geometry?.type === "Polygon",
                                    )
                                    if (polygonFeature) {
                                        handleClickSavedField(
                                            polygonFeature as Feature<Polygon>,
                                        )
                                    }
                                }}
                            >
                                <Controls
                                    onViewportChange={({
                                        longitude,
                                        latitude,
                                        zoom,
                                    }) =>
                                        setViewState((currentViewState) => ({
                                            ...currentViewState,
                                            longitude,
                                            latitude,
                                            zoom,
                                            pitch: currentViewState.pitch,
                                            bearing: currentViewState.bearing,
                                        }))
                                    }
                                    showFields={showFields}
                                    onToggleFields={() =>
                                        setShowFields(!showFields)
                                    }
                                    showFlyToFields={
                                        fieldsSaved.features.length +
                                            selectedFieldsData.features.length >
                                        0
                                            ? true
                                            : undefined
                                    }
                                    onFlyToFields={() => {
                                        const overallViewState = getViewState(
                                            featureCollection([
                                                ...fieldsSaved.features,
                                                ...selectedFieldsData.features,
                                            ]),
                                        )
                                        setViewState(overallViewState)
                                        if (overallViewState.bounds) {
                                            mapRef.current?.fitBounds(
                                                overallViewState.bounds,
                                                overallViewState.fitBoundsOptions,
                                            )
                                        }
                                    }}
                                />

                                <MapTilerAttribution />

                                <FieldsSourceAvailable
                                    id={fieldsAvailableId}
                                    calendar={loaderData.calendar}
                                    zoomLevelFields={ZOOM_LEVEL_FIELDS}
                                    redirectToDetailsPage={false}
                                >
                                    <Layer
                                        {...({
                                            ...fieldsAvailableStyle,
                                            layout: layerLayout,
                                        } as any)}
                                    />
                                </FieldsSourceAvailable>

                                <FieldsSourceSelected
                                    id={fieldsSelectedId}
                                    availableLayerId={fieldsAvailableId}
                                    fieldsData={selectedFieldsData}
                                    setFieldsData={setSelectedFieldsData}
                                    excludedLayerId={fieldsSavedId}
                                >
                                    <Layer
                                        {...({
                                            ...fieldsSelectedStyle,
                                            layout: layerLayout,
                                        } as any)}
                                    />
                                </FieldsSourceSelected>

                                <FieldsSourceNotClickable
                                    id={fieldsSavedId}
                                    fieldsData={fieldsSaved}
                                >
                                    <Layer
                                        {...fieldsSavedOutlineStyle}
                                        source={fieldsSavedId}
                                    />
                                    <Layer
                                        {...fieldsSavedStyle}
                                        source={fieldsSavedId}
                                    />
                                </FieldsSourceNotClickable>

                                <div className="fields-panel grid gap-4 w-[350px]">
                                    <FieldsPanelSelection
                                        fields={selectedFieldsData}
                                        numFieldsSaved={
                                            loaderData.fieldsSaved.features
                                                .length
                                        }
                                        continueTo={loaderData.continueTo}
                                    />
                                    <FieldsPanelZoom
                                        zoomLevelFields={ZOOM_LEVEL_FIELDS}
                                    />
                                    <FieldsPanelHover
                                        zoomLevelFields={ZOOM_LEVEL_FIELDS}
                                        layer={fieldsAvailableId}
                                        layerExclude={[
                                            fieldsSelectedId,
                                            fieldsSavedId,
                                        ]}
                                    />
                                    <FieldsPanelHover
                                        zoomLevelFields={ZOOM_LEVEL_FIELDS}
                                        layer={fieldsSelectedId}
                                    />
                                </div>
                            </MapGL>
                        )}
                    </ClientOnly>
                </div>
            </main>
            {selectedField && (
                <FieldDetailsInfoPopup
                    open={open}
                    setOpen={setOpen}
                    field={selectedField}
                    hint="Dit perceel is al opgeslagen. U kunt percelen verwijderen op de volgende pagina."
                />
            )}
        </SidebarInset>
    )
}

/**
 * Processes form submission for adding fields to a farm.
 *
 * This action extracts selected fields from the incoming form data, validates the presence
 * of the farm identifier, and establishes the user session. It adds each field to the specified farm,
 * creates the corresponding cultivation entry, and conditionally performs soil analysis if an API key is present.
 * Upon successful processing, it redirects to the farm fields page with a success message.
 *
 * ~returns A redirect response to the farm fields page with a success message.
 *
 * ~throws {Error} If the farm identifier is missing or if an operation (such as adding a field, cultivation,
 * or soil analysis) fails.
 */
export async function action({ request, params }: ActionFunctionArgs) {
    try {
        const formData = await request.formData()
        const b_id_farm = params.b_id_farm

        if (!b_id_farm) {
            throw new Error("missing: b_id_farm")
        }

        // Get the session
        const session = await getSession(request)

        // Get timeframe from calendar store
        const calendar = getCalendar(params)
        const timeframe = getTimeframe(params)
        let firstFieldIndex: number
        try {
            firstFieldIndex =
                (
                    await getFields(
                        fdm,
                        session.principal_id,
                        b_id_farm,
                        timeframe,
                    )
                ).length + 1
        } catch (e) {
            console.warn(e)
            firstFieldIndex = 1
        }

        const nmiApiKey = getNmiApiKey()

        const selectedFields = JSON.parse(
            String(formData.get("selected_fields")),
        )

        // Add fields to farm
        await Promise.all(
            selectedFields.features.map(
                async (
                    field: Feature<Polygon, GeoJsonProperties>,
                    index: number,
                ) => {
                    if (!field.properties) {
                        throw new Error("missing: field.properties")
                    }
                    const b_name = `Perceel ${firstFieldIndex + index}`
                    const b_id_source = field.properties.b_id_source
                    const b_lu_catalogue = field.properties.b_lu_catalogue
                    const b_geometry = field.geometry

                    const parsedYear = Number.parseInt(
                        String(calendar ?? ""),
                        10,
                    )
                    const currentYear =
                        Number.isInteger(parsedYear) &&
                        parsedYear >= 1970 &&
                        parsedYear < 2100
                            ? parsedYear
                            : timeframe.start.getFullYear()
                    const cultivationDefaultDates =
                        await getDefaultDatesOfCultivation(
                            fdm,
                            session.principal_id,
                            b_id_farm,
                            b_lu_catalogue,
                            currentYear,
                        )
                    const b_start = new Date(`${currentYear}-01-01`)
                    const b_lu_start = cultivationDefaultDates.b_lu_start
                    const b_lu_end = cultivationDefaultDates.b_lu_end
                    const b_end = undefined
                    const b_acquiring_method = "unknown"

                    const b_id = await addField(
                        fdm,
                        session.principal_id,
                        b_id_farm,
                        b_name,
                        b_id_source,
                        b_geometry,
                        b_start,
                        b_acquiring_method,
                        b_end,
                    )
                    await addCultivation(
                        fdm,
                        session.principal_id,
                        b_lu_catalogue,
                        b_id,
                        b_lu_start,
                        b_lu_end,
                    )

                    if (nmiApiKey) {
                        const estimates = await getSoilParameterEstimates(
                            field,
                            nmiApiKey,
                        )

                        await addSoilAnalysis(
                            fdm,
                            session.principal_id,
                            undefined,
                            estimates.a_source,
                            b_id,
                            estimates.a_depth_lower,
                            undefined,
                            estimates,
                        )
                    }

                    return b_id
                },
            ),
        )

        return redirectWithSuccess(
            `/farm/create/${b_id_farm}/${calendar}/fields`,
            {
                message: "Percelen zijn toegevoegd! 🎉",
            },
        )
    } catch (error) {
        throw handleActionError(error)
    }
}
