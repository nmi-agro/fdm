import {
    getCultivations,
    getCultivationsFromCatalogue,
    getCurrentSoilData,
    getField,
    getSoilParametersDescription,
    removeField,
    updateCultivation,
    updateField,
} from "@nmi-agro/fdm-core"
import type { FeatureCollection } from "geojson"
import {
    type ActionFunctionArgs,
    data,
    type LoaderFunctionArgs,
    type MetaFunction,
    useLoaderData,
} from "react-router"
import { dataWithSuccess, redirectWithSuccess } from "remix-toast"
import { NewFieldsBlock } from "~/components/blocks/fields-new/block"
import { FormSchema } from "~/components/blocks/fields-new/schema"
import { getMapStyle } from "~/integrations/map"
import { getSession } from "~/lib/auth.server"
import { getCalendar, getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { extractFormValuesFromRequest } from "~/lib/form"

// Meta
export const meta: MetaFunction = () => {
    return [
        { title: `${clientConfig.name} App` },
        { name: "description", content: `Welcome to ${clientConfig.name}!` },
    ]
}

// Form Schema

/**
 * Retrieves and prepares data for rendering the field details page.
 *
 * This loader validates the presence of the required farm and field IDs extracted from the URL parameters,
 * obtains the session information, and uses it to fetch the associated field data. It constructs a GeoJSON
 * FeatureCollection based on the field's geometry and retrieves additional details such as soil analysis,
 * cultivation options filtered from the catalogue, and Maplibre configuration (token and style).
 *
 * @param request - The incoming HTTP request.
 * @param params - URL parameters with 'b_id_farm' as the farm ID and 'b_id' as the field ID.
 * @returns An object containing field properties, soil analysis, cultivation details, a GeoJSON FeatureCollection,
 *   and Maplibre configuration needed for the field details page.
 * @throws {Error} When required identifiers (farm ID, field ID), field data, or field geometry are missing.
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
    try {
        // Get the Id of the farm
        const b_id_farm = params.b_id_farm
        if (!b_id_farm) {
            throw data("Farm ID is required", {
                status: 400,
                statusText: "Farm ID is required",
            })
        }

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

        const timeframe = await getTimeframe(params)

        // Get the field data
        const field = await getField(fdm, session.principal_id, b_id)
        if (!field) {
            throw data("Field not found", {
                status: 404,
                statusText: "Field not found",
            })
        }

        // Get the geojson
        if (!field.b_geometry) {
            throw data("Field geometry is required", {
                status: 400,
                statusText: "Field geometry is required",
            })
        }

        const feature: GeoJSON.Feature = {
            type: "Feature",
            properties: {
                b_id: field.b_id,
                b_name: field.b_name,
                b_area: Math.round((field.b_area ?? 0) * 10) / 10,
                b_id_source: field.b_id_source,
            },
            geometry: field.b_geometry,
        }
        const featureCollection: FeatureCollection = {
            type: "FeatureCollection",
            features: [feature],
        }

        // Get soil analysis data
        const currentSoilData = await getCurrentSoilData(
            fdm,
            session.principal_id,
            b_id,
            timeframe,
        )
        const soilParameterDescription = getSoilParametersDescription()

        // Check if the current soil data is an estimate
        const isEstimated =
            currentSoilData.length > 0 &&
            currentSoilData.every((i) => i.a_source === "nl-other-nmi")

        // Get the available cultivations
        let cultivationOptions = []
        const cultivationsCatalogue = await getCultivationsFromCatalogue(
            fdm,
            session.principal_id,
            b_id_farm,
        )
        cultivationOptions = cultivationsCatalogue
            .filter(
                (cultivation) =>
                    cultivation?.b_lu_catalogue && cultivation?.b_lu_name,
            )
            .map((cultivation) => ({
                value: cultivation.b_lu_catalogue,
                label: `${cultivation.b_lu_name} (${cultivation.b_lu_catalogue.split("_")[1]})`,
            }))

        // Get the cultivation
        const cultivations = await getCultivations(
            fdm,
            session.principal_id,
            b_id,
            timeframe,
        )
        const b_lu_catalogue = cultivations[0]?.b_lu_catalogue

        // Get Map Style
        const mapStyle = getMapStyle("satellite")

        return {
            b_id: b_id,
            b_id_farm: b_id_farm,
            b_name: field.b_name,
            b_lu_catalogue: b_lu_catalogue,
            b_lu_start: cultivations[0]?.b_lu_start,
            currentSoilData: currentSoilData,
            isEstimated: isEstimated,
            soilParameterDescription: soilParameterDescription,
            b_area: field.b_area ?? 0,
            b_bufferstrip: field.b_bufferstrip,
            featureCollection: featureCollection,
            cultivationOptions: cultivationOptions,
            mapStyle: mapStyle,
        }
    } catch (error) {
        throw handleLoaderError(error)
    }
}

/**
 * Component for displaying and updating field details.
 * Renders a form with field information, including name, crop, soil type, and soil analysis data.
 * @returns The JSX element representing the field details page.
 */
export default function Index() {
    const loaderData = useLoaderData<typeof loader>()

    return (
        <NewFieldsBlock
            b_id={loaderData.b_id}
            b_name={loaderData.b_name}
            b_lu_catalogue={loaderData.b_lu_catalogue}
            b_area={loaderData.b_area}
            b_bufferstrip={loaderData.b_bufferstrip}
            cultivationOptions={loaderData.cultivationOptions}
            featureCollection={loaderData.featureCollection}
            mapStyle={loaderData.mapStyle}
            currentSoilData={loaderData.currentSoilData}
            isEstimated={loaderData.isEstimated}
            soilParameterDescription={loaderData.soilParameterDescription}
            isFarmCreateWizard={true}
        />
    )
}

/**
 * Processes the form submission to update field details.
 *
 * This function validates that the necessary URL parameters for the field and farm IDs are present.
 * It extracts form data and session information from the incoming request, updates the field record,
 * and, if applicable, updates the related cultivation data. If the submitted soil properties differ from
 * the existing values, a new soil analysis entry is added.
 *
 * @param request - The HTTP request containing form submission and session data.
 * @param params - An object with URL parameters including the field ID (b_id) and farm ID (b_id_farm).
 * @returns A payload with a success message upon successful update.
 * @throws {Error} If either the field ID or farm ID is missing.
 */
export async function action({ request, params }: ActionFunctionArgs) {
    try {
        const b_id = params.b_id
        if (!b_id) {
            throw new Error("missing: b_id")
        }
        const b_id_farm = params.b_id_farm
        if (!b_id_farm) {
            throw new Error("missing: b_id_farm")
        }

        // Get the session
        const session = await getSession(request)

        const timeframe = getTimeframe(params)
        const calendar = getCalendar(params)

        if (request.method === "POST") {
            const formValues = await extractFormValuesFromRequest(
                request,
                FormSchema,
            )

            await updateField(
                fdm,
                session.principal_id,
                b_id,
                formValues.b_name,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                formValues.b_bufferstrip,
            )

            const cultivations = await getCultivations(
                fdm,
                session.principal_id,
                b_id,
                timeframe,
            )
            if (cultivations && cultivations.length > 0) {
                await updateCultivation(
                    fdm,
                    session.principal_id,
                    cultivations[0].b_lu,
                    formValues.b_lu_catalogue,
                    undefined,
                    undefined,
                )

                return dataWithSuccess("fields have been updated", {
                    message: `${formValues.b_name} is bijgewerkt! 🎉`,
                })
            }
        } else if (request.method === "DELETE") {
            // Delete field
            const field = await getField(fdm, session.principal_id, b_id)
            await removeField(fdm, session.principal_id, b_id)
            return redirectWithSuccess(
                `/farm/create/${b_id_farm}/${calendar}/fields`,
                {
                    message: `${field.b_name} is verwijderd! 🎉`,
                },
            )
        } else {
            throw new Error("invalid method")
        }
    } catch (error) {
        throw handleActionError(error)
    }
}
