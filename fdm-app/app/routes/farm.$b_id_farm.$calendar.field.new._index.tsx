import {
    addCultivation,
    addField,
    addSoilAnalysis,
    getCultivations,
    getDefaultDatesOfCultivation,
    getFarm,
    getFarms,
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
import FieldDetailsInfoPopup from "~/components/blocks/field/popup"
import { Header } from "~/components/blocks/header/base"
import { HeaderFarm } from "~/components/blocks/header/farm"
import { HeaderField } from "~/components/blocks/header/field"
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

// Meta
export const meta: MetaFunction = () => {
    return [
        { title: `Nieuw perceel | ${clientConfig.name}` },
        {
            name: "description",
            content: "Voeg nieuwe percelen toe",
        },
    ]
}

/**
 * Retrieves farm details and map configurations for rendering the farm map.
 *
 * This loader function extracts the farm ID from route parameters, validates its presence, and uses the current session to fetch the corresponding farm details. It then retrieves the Maplibre token and style configuration, and returns these along with the farm's display name and a URL for available fields. Any errors encountered during processing are transformed using {@link handleLoaderError}.
 *
 * @throws {Response} When the farm ID is missing, the specified farm is not found, or another error occurs during data retrieval.
 *
 * @returns An object containing the farm name, Maplibre token, Maplibre style, and the URL for available fields.
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

        // Get a list of possible farms of the user
        const farms = await getFarms(fdm, session.principal_id)
        const farmOptions = farms.map((farm) => {
            if (!farm?.b_id_farm || !farm?.b_name_farm) {
                throw new Error("Invalid farm data structure")
            }
            return {
                b_id_farm: farm.b_id_farm,
                b_name_farm: farm.b_name_farm,
            }
        })

        const farm = await getFarm(fdm, session.principal_id, b_id_farm)

        if (!farm) {
            throw data("Farm not found", {
                status: 404,
                statusText: "Farm not found",
            })
        }

        // Get timeframe from calendar store
        const calendar = getCalendar(params)
        const timeframe = getTimeframe(params)

        // Get the fields of the farm
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
            farmOptions: farmOptions,
            b_id_farm: b_id_farm,
            b_name_farm: farm.b_name_farm,
            fieldsSaved: fieldsSaved,
            calendar: calendar,
            mapStyle: mapStyle,
            continueTo: `/farm/${b_id_farm}/${calendar}/field`,
        }
    } catch (error) {
        throw handleLoaderError(error)
    }
}

// Main
export default function Index() {
    const loaderData = useLoaderData<typeof loader>()

    const fieldsAvailableId = "fieldsAvailable"

    const initialViewState = getViewState(loaderData.fieldsSaved)
    const fieldsAvailableStyle = getFieldsStyle(fieldsAvailableId)

    const [viewState, setViewState] = useState<ViewState>(
        initialViewState as ViewState,
    )

    // onViewportChange handler as Controls requires it
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
    const calendar = loaderData.calendar
    const fieldsSavedStyle = getFieldsStyle(fieldsSavedId)

    const fieldsSavedOutlineStyle = getFieldsStyle("fieldsSavedOutline")

    // Set selected fields
    const [selectedFieldsData, setSelectedFieldsData] = useState(
        generateFeatureClass(),
    )

    const [showFields, setShowFields] = useState(true) // Added showFields state
    const layerLayout = { visibility: showFields ? "visible" : "none" } as const // Define layerLayout

    const mapRef = useRef<MapRef>(null)

    return (
        <SidebarInset>
            <Header
                action={{
                    to: `/farm/${loaderData.b_id_farm}/${calendar}/field/`,
                    label: "Terug naar percelen",
                    disabled: false,
                }}
            >
                <HeaderFarm
                    b_id_farm={loaderData.b_id_farm}
                    farmOptions={loaderData.farmOptions}
                />
                <HeaderField
                    b_id_farm={loaderData.b_id_farm}
                    fieldOptions={[]}
                    b_id={undefined}
                />
            </Header>
            {/* <FarmHeader
                farmOptions={loaderData.farmOptions}
                b_id_farm={loaderData.b_id_farm}
                fieldOptions={undefined}
                b_id={undefined}
                layerOptions={[]}
                layerSelected={undefined}
                fertilizerOptions={undefined}
                p_id={undefined}
                action={{
                    to: `/farm/${loaderData.b_id_farm}/${calendar}/field/`,
                    label: "Terug naar percelen",
                }}
            /> */}
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
                                {...viewState} // Use viewState directly
                                ref={mapRef}
                                style={{
                                    height: "calc(100vh - 64px - 123px)",
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
                                    onViewportChange={(viewport) =>
                                        setViewState((currentViewState) => ({
                                            ...currentViewState,
                                            ...viewport,
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
                    hint="Dit perceel is al opgeslagen. U kunt bestaande percelen beheren op de pagina Percelen."
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
 * @returns A redirect response to the farm fields page with a success message.
 *
 * @throws {Error} If the farm identifier is missing or if an operation (such as adding a field, cultivation,
 * or soil analysis) fails.
 */
export async function action({ request, params }: ActionFunctionArgs) {
    try {
        const formData = await request.formData()

        // Get the farm id
        const b_id_farm = params.b_id_farm
        if (!b_id_farm) {
            throw data("Farm ID is required", {
                status: 400,
                statusText: "Farm ID is required",
            })
        }

        // Get the session
        const session = await getSession(request)

        // Get the timeframe from calendar store
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

        // Get form values
        const selectedFields = JSON.parse(
            String(formData.get("selected_fields")),
        )

        // Add fields to farm
        const fieldIds: string[] = await Promise.all(
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
                    if (!b_id_source)
                        throw new Error("missing: field.properties.b_id_source")
                    const b_lu_catalogue = field.properties.b_lu_catalogue
                    if (!b_lu_catalogue)
                        throw new Error(
                            "missing: field.properties.b_lu_catalogue",
                        )
                    const b_geometry = field.geometry
                    if (!b_geometry) throw new Error("missing: b_geometry")

                    const parsedYear = Number.parseInt(
                        String(calendar ?? ""),
                        10,
                    )
                    const currentYear =
                        Number.isInteger(parsedYear) &&
                        parsedYear >= 1970 &&
                        parsedYear < 2100
                            ? parsedYear
                            : timeframe.start?.getFullYear()
                    if (!currentYear && currentYear !== 0) {
                        throw new Error("missing: year")
                    }
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
            `/farm/${b_id_farm}/${calendar}/field/new/fields?fieldIds=${fieldIds.map(encodeURIComponent).join(",")}`,
            {
                message: `${fieldIds.length} ${fieldIds.length === 1 ? "perceel is" : "percelen zijn"} toegevoegd! 🎉`,
            },
        )
    } catch (error) {
        throw handleActionError(error)
    }
}
