import { getField } from "@nmi-agro/fdm-core"
import type { FeatureCollection } from "geojson"
import maplibregl from "maplibre-gl"
import { useEffect, useRef } from "react"
import { Layer, Map as MapGL, type MapRef } from "react-map-gl/maplibre"
import type { MetaFunction } from "react-router"
import {
    type ActionFunctionArgs,
    data,
    type LoaderFunctionArgs,
    useLoaderData,
} from "react-router"
import { ClientOnly } from "remix-utils/client-only"
import { MapTilerAttribution } from "~/components/blocks/atlas/atlas-attribution"
import { FieldsSourceNotClickable } from "~/components/blocks/atlas/atlas-sources"
import { getFieldsStyle } from "~/components/blocks/atlas/atlas-styles"
import { getViewState } from "~/components/blocks/atlas/atlas-viewstate"
import { Separator } from "~/components/ui/separator"
import { Skeleton } from "~/components/ui/skeleton"
import { getMapStyle } from "~/integrations/map"
import { getSession } from "~/lib/auth.server"
import { clientConfig } from "~/lib/config"
import { handleActionError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"

export const meta: MetaFunction = () => {
    return [
        { title: `Kaart - Perceel | ${clientConfig.name}` },
        {
            name: "description",
            content:
                "Bekijk uw perceel op de kaart met interactieve visualisatie van de locatie, grenzen en geografische kenmerken.",
        },
    ]
}

/**
 * Loads field data and map configuration for rendering a farm field on the map.
 *
 * This function retrieves a farm field's details using the field ID from the route parameters. It establishes a valid user session and uses it to fetch the corresponding field data. The retrieved field details are formatted into a GeoJSON FeatureCollection, and map style configuration is provided for rendering.
 *
 * @returns An object containing the field's GeoJSON FeatureCollection and map style.
 *
 * @throws {Response} Thrown if the field ID is missing from the parameters or if the field is not found.
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
    try {
        // Get the field id
        const b_id = params.b_id
        if (!b_id) {
            throw data("Field ID is required", {
                status: 400,
                statusText: "Field ID is required",
            })
        }
        // Get the session
        const session = await getSession(request)

        // Get details of field
        const field = await getField(fdm, session.principal_id, b_id)
        if (!field) {
            throw data("Field is not found", {
                status: 404,
                statusText: "Field is not found",
            })
        }
        const feature = {
            type: "Feature" as const,
            properties: {
                b_id: field.b_id,
                b_name: field.b_name,
                b_area: Math.round(field.b_area * 10) / 10,
                b_lu_name: field.b_lu_name,
                b_id_source: field.b_id_source,
            },
            geometry: field.b_geometry,
        }
        const featureCollection: FeatureCollection = {
            type: "FeatureCollection",
            features: [feature],
        }

        // Get map style
        const mapStyle = getMapStyle("satellite")

        // Return user information from loader
        return {
            field: featureCollection,
            mapStyle: mapStyle,
        }
    } catch (error) {
        throw handleActionError(error)
    }
}

/**
 * Renders a MapLibre map view of a farm field.
 *
 *  This component uses data retrieved from the loader to display a non-interactive map with the field overlaid as a styled layer. It computes the view state and field styles, then conditionally renders the map on the client side with a skeleton fallback.
 *
 * @returns A JSX element displaying the field map.
 */
export default function FarmFieldAtlasBlock() {
    const loaderData = useLoaderData<typeof loader>()

    const id = "fieldsSaved"
    const fields = loaderData.field
    const viewState = getViewState(fields)
    const fieldsSavedStyle = getFieldsStyle(id)
    const fieldsSavedOutlineStyle = getFieldsStyle("fieldsSavedOutline")

    const mapRef = useRef<MapRef>(null)

    useEffect(() => {
        const vs = viewState as any
        if (vs.bounds) {
            mapRef.current?.fitBounds(vs.bounds, vs.fitBoundsOptions)
        }
    }, [viewState])

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium">Kaart</h3>
                <p className="text-sm text-muted-foreground">
                    Bekijk het perceel op de kaart
                </p>
            </div>
            <Separator />
            <div>
                <ClientOnly
                    fallback={<Skeleton className="h-full w-full rounded-xl" />}
                >
                    {() => (
                        <MapGL
                            {...viewState}
                            style={{
                                height: "60%",
                                width: "70%",
                                position: "absolute",
                            }}
                            interactive={false}
                            mapStyle={loaderData.mapStyle}
                            mapLib={maplibregl}
                            interactiveLayerIds={[id]}
                            ref={mapRef}
                        >
                            <MapTilerAttribution />
                            <FieldsSourceNotClickable
                                id={id}
                                fieldsData={fields}
                            >
                                <Layer {...fieldsSavedStyle} />
                                <Layer {...fieldsSavedOutlineStyle} />
                            </FieldsSourceNotClickable>
                        </MapGL>
                    )}
                </ClientOnly>
            </div>
        </div>
    )
}

/**
 * Validates the presence of a field identifier in the route parameters.
 *
 * Extracts the field ID (b_id) from the provided parameters and throws an error if it is absent,
 * ensuring the action has the required identifier. Any errors are caught and rethrown via the
 * error handling mechanism.
 *
 * @param request - The HTTP request associated with the action.
 * @param params - The route parameters, expected to include a valid field identifier (b_id).
 *
 * @throws {Error} When the field identifier is missing.
 */
export async function action({ request, params }: ActionFunctionArgs) {
    try {
        const b_id = params.b_id

        if (!b_id) {
            throw new Error("Missing field ID.")
        }
    } catch (error) {
        throw handleActionError(error)
    }
}
