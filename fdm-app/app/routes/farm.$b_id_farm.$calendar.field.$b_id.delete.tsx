import { getField, removeField } from "@nmi-agro/fdm-core"
import {
    type ActionFunctionArgs,
    data,
    Form,
    type LoaderFunctionArgs,
    type MetaFunction,
    useLoaderData,
} from "react-router"
import { RemixFormProvider, useRemixForm } from "remix-hook-form"
import { redirectWithSuccess } from "remix-toast"
import { FieldDeleteDialog } from "~/components/blocks/field/delete"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import { getSession } from "~/lib/auth.server"
import { clientConfig } from "~/lib/config"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { getCalendar } from "../lib/calendar"

// Meta
export const meta: MetaFunction = () => {
    return [
        { title: `Verwijderen - Perceel | ${clientConfig.name}` },
        {
            name: "description",
            content: "Verwijder dit perceel",
        },
    ]
}

/**
 * Loads field details using the farm and field IDs from route parameters.
 *
 * This function validates that both the farm ID and field ID are provided. It then retrieves the current session to obtain the
 * user's principal ID and uses this information to fetch the corresponding field details. If any required ID is missing or if the
 * field is not found, it throws an error with the appropriate HTTP status code. Errors encountered during processing are handled
 * by a centralized error handler.
 *
 * @throws {Response} When the farm ID or field ID is missing, or if the field is not found.
 *
 * @returns An object containing the field details.
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
    try {
        // Get the farm id
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

        // Get details of field
        const field = await getField(fdm, session.principal_id, b_id)
        if (!field) {
            throw data("Field is not found", {
                status: 404,
                statusText: "Field is not found",
            })
        }

        // Return user information from loader
        return {
            field: field,
        }
    } catch (error) {
        throw handleLoaderError(error)
    }
}

/**
 * Renders the field deletion confirmation page.
 *
 * This component displays a warning message about the irreversible nature of field deletion
 * and provides a confirmation dialog using shadcn/ui components.
 */
export default function FieldDeletePage() {
    const { field } = useLoaderData<typeof loader>()

    const form = useRemixForm({
        mode: "onTouched",
        defaultValues: {},
        submitData: {},
    })

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Permanent verwijderen</CardTitle>
                    <CardDescription>
                        Deze actie kan niet ongedaan worden gemaakt. Dit
                        verwijdert het perceel "{field.b_name}" en alle
                        bijbehorende gegevens, inclusief gewassen, bemestingen,
                        bodemanalyses en oogsten.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <RemixFormProvider {...form}>
                        <Form
                            id="formFieldDelete"
                            onSubmit={form.handleSubmit}
                            method="post"
                        >
                            <fieldset disabled={form.formState.isSubmitting}>
                                <FieldDeleteDialog
                                    fieldName={field.b_name}
                                    isSubmitting={form.formState.isSubmitting}
                                />
                            </fieldset>
                        </Form>
                    </RemixFormProvider>
                </CardContent>
            </Card>
        </div>
    )
}

/**
 * Handles the deletion of a field.
 *
 * This action function retrieves the farm and field IDs from the request parameters,
 * validates their presence, and then calls the `removeField` function from `@nmi-agro/fdm-core`
 * to delete the specified field and all its associated data.
 *
 * Upon successful deletion, the user is redirected to the fields overview page.
 * Errors during the process are caught and handled by `handleLoaderError`.
 *
 * @param {ActionFunctionArgs} { request, params } - The Remix action function arguments.
 * @returns {Promise<Response>} A promise that resolves to a redirect response or throws an error.
 */
export async function action({ request, params }: ActionFunctionArgs) {
    try {
        // Get the farm id
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

        const calendar = getCalendar(params)

        // Get details of field
        const field = await getField(fdm, session.principal_id, b_id)

        // Remove the field
        await removeField(fdm, session.principal_id, b_id)

        // Redirect to the farm page after successful deletion
        return redirectWithSuccess(
            `/farm/${b_id_farm}/${calendar}/field`,
            `${field.b_name} is verwijderd`,
        )
    } catch (error) {
        throw handleLoaderError(error)
    }
}
