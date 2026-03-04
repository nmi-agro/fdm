import { zodResolver } from "@hookform/resolvers/zod"
import {
    checkPermission,
    getField,
    listAvailableAcquiringMethods,
    updateField,
} from "@nmi-agro/fdm-core"
import { useEffect } from "react"
import { Controller } from "react-hook-form"
import type { MetaFunction } from "react-router"
import {
    type ActionFunctionArgs,
    data,
    Form,
    type LoaderFunctionArgs,
    useLoaderData,
} from "react-router"
import { RemixFormProvider, useRemixForm } from "remix-hook-form"
import { dataWithSuccess } from "remix-toast"
import { z } from "zod"
import { DatePicker } from "~/components/custom/date-picker-v2"
import { Button } from "~/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import { Field, FieldError, FieldLabel } from "~/components/ui/field"
import { Input } from "~/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "~/components/ui/select"
import { Spinner } from "~/components/ui/spinner"
import { Switch } from "~/components/ui/switch"
import { getSession } from "~/lib/auth.server"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { extractFormValuesFromRequest } from "~/lib/form"
import { cn } from "~/lib/utils"

export const meta: MetaFunction = () => {
    return [
        { title: `Overzicht - Perceel | ${clientConfig.name}` },
        {
            name: "description",
            content:
                "Bekijk en beheer de algemene informatie van uw perceel, inclusief naam, eigendomsgegevens en tijdsperiode.",
        },
    ]
}

/**
 * Loads farm field details for the overview page.
 *
 * Retrieves the field ID from route parameters and uses the current user's session to fetch the corresponding field details.
 * Throws an error with a 400 status if the field ID is missing, or with a 404 status if the field is not found.
 *
 * @returns An object containing the retrieved field details.
 *
 * @throws {Response} When the field ID is missing or the field is not found.
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

        const fieldWritePermission = await checkPermission(
            fdm,
            "field",
            "write",
            b_id,
            session.principal_id,
            new URL(request.url).pathname,
            false,
        )

        // Return user information from loader
        return {
            field: field,
            fieldWritePermission,
            acquiringMethodOptions: listAvailableAcquiringMethods(),
        }
    } catch (error) {
        throw handleLoaderError(error)
    }
}

/**
 * Renders the overview block for editing farm field details.
 *
 * Retrieves initial field data via useLoaderData and initializes a validated form with fields for the
 * field's name, acquiring method, acquiring date, and terminating date. The form automatically resets
 * its values when updated loader data is provided and integrates with a submit handler to update the field.
 */
export default function FarmFieldsOverviewBlock() {
    const loaderData = useLoaderData<typeof loader>()

    const form = useRemixForm<z.infer<typeof FormSchema>>({
        mode: "onTouched",
        resolver: zodResolver(FormSchema),
        defaultValues: {
            b_name: loaderData.field.b_name,
            b_acquiring_method: loaderData.field.b_acquiring_method,
            b_start: loaderData.field.b_start ?? new Date(),
            b_end: loaderData.field.b_end,
            b_bufferstrip: loaderData.field.b_bufferstrip ?? false,
        },
    })

    useEffect(() => {
        form.reset({
            b_name: loaderData.field.b_name,
            b_acquiring_method: loaderData.field.b_acquiring_method,
            b_start: loaderData.field.b_start ?? new Date(),
            b_end: loaderData.field.b_end,
            b_bufferstrip: loaderData.field.b_bufferstrip ?? false,
        })
    }, [loaderData, form.reset])

    return (
        <Card>
            <CardHeader>
                <CardTitle>Overzicht</CardTitle>
                <CardDescription>
                    Beheer de algemene gegevens van dit perceel
                </CardDescription>
            </CardHeader>
            <CardContent>
                <RemixFormProvider {...form}>
                    <Form
                        id="formFieldOverview"
                        onSubmit={form.handleSubmit}
                        method="post"
                    >
                        <fieldset disabled={form.formState.isSubmitting}>
                            <div className="grid grid-cols-1 xl:grid-cols-2 w-full gap-6">
                                <Controller
                                    control={form.control}
                                    name="b_name"
                                    render={({ field, fieldState }) => (
                                        <Field
                                            data-invalid={fieldState.invalid}
                                            className="col-span-1 xl:col-span-2"
                                        >
                                            <FieldLabel>
                                                Perceelsnaam
                                            </FieldLabel>
                                            <Input
                                                placeholder="bv. Achter het erf"
                                                {...field}
                                                required
                                            />
                                            <FieldError
                                                errors={[fieldState.error]}
                                            />
                                        </Field>
                                    )}
                                />
                                <Controller
                                    control={form.control}
                                    name="b_acquiring_method"
                                    render={({ field, fieldState }) => (
                                        <Field
                                            data-invalid={fieldState.invalid}
                                            className="col-span-1"
                                        >
                                            <FieldLabel>
                                                Eigendom of pacht?
                                            </FieldLabel>
                                            <Select
                                                onValueChange={field.onChange}
                                                value={field.value}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Maak een keuze..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {loaderData.acquiringMethodOptions.map(
                                                        (option) => (
                                                            <SelectItem
                                                                key={
                                                                    option.value
                                                                }
                                                                value={
                                                                    option.value
                                                                }
                                                            >
                                                                {option.label}
                                                            </SelectItem>
                                                        ),
                                                    )}
                                                </SelectContent>
                                            </Select>
                                            <FieldError
                                                errors={[fieldState.error]}
                                            />
                                        </Field>
                                    )}
                                />
                                <Controller
                                    control={form.control}
                                    name="b_bufferstrip"
                                    render={({ field }) => (
                                        <div className="col-span-1 flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm gap-4">
                                            <div className="space-y-0.5 min-w-0">
                                                <FieldLabel
                                                    className="text-base cursor-pointer"
                                                    htmlFor="b_bufferstrip"
                                                >
                                                    Bufferstrook
                                                </FieldLabel>
                                                <p className="text-sm text-muted-foreground break-words">
                                                    Is dit perceel een
                                                    bufferstrook?{" "}
                                                </p>
                                            </div>
                                            <div className="flex-shrink-0">
                                                <Switch
                                                    id="b_bufferstrip"
                                                    checked={field.value}
                                                    onCheckedChange={
                                                        field.onChange
                                                    }
                                                />
                                            </div>
                                        </div>
                                    )}
                                />
                                <Controller
                                    control={form.control}
                                    name="b_start"
                                    render={({ field, fieldState }) => (
                                        <DatePicker
                                            label="Vanaf wanneer in gebruik?"
                                            field={field}
                                            fieldState={fieldState}
                                            className="col-span-1"
                                        />
                                    )}
                                />
                                <Controller
                                    control={form.control}
                                    name="b_end"
                                    render={({ field, fieldState }) => (
                                        <DatePicker
                                            label="Tot wanneer in gebruik?"
                                            description="Optioneel"
                                            field={field}
                                            fieldState={fieldState}
                                            className="col-span-1"
                                        />
                                    )}
                                />
                            </div>
                        </fieldset>

                        <div className="flex justify-end pt-6">
                            <Button
                                type="submit"
                                disabled={form.formState.isSubmitting}
                                className={cn(
                                    !loaderData.fieldWritePermission &&
                                        "invisible",
                                )}
                            >
                                {form.formState.isSubmitting && <Spinner />}
                                Bijwerken
                            </Button>
                        </div>
                    </Form>
                </RemixFormProvider>
            </CardContent>
        </Card>
    )
}

/**
 * Updates a farm field's details using the form data submitted in the request.
 *
 * This action function retrieves the required field identifier from the route parameters, obtains the user session,
 * and extracts validated form data according to a predefined schema. It then updates the corresponding farm field record
 * and returns a success response. Any errors encountered during the process are handled by a centralized error handler.
 */
export async function action({ request, params }: ActionFunctionArgs) {
    try {
        const b_id = params.b_id

        if (!b_id) {
            throw new Error("missing: b_id")
        }

        // Get the session
        const session = await getSession(request)

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
            formValues.b_start,
            formValues.b_acquiring_method,
            formValues.b_end,
            formValues.b_bufferstrip,
        )

        return dataWithSuccess("field is updated", {
            message: `Perceel ${formValues.b_name} is bijgewerkt! 🎉`,
        })
    } catch (error) {
        return handleActionError(error)
    }
}

// Form Schema
const FormSchema = z
    .object({
        b_name: z.string().trim().min(2, {
            error: "Naam van perceel moet minimaal 2 karakters bevatten",
        }),
        b_acquiring_method: z.string({
            error: (issue) =>
                issue.input === undefined
                    ? "Selecteer of het perceel in eigendom is of gepacht"
                    : undefined,
        }),
        b_start: z.preprocess(
            (val) => (typeof val === "string" ? new Date(val) : val),
            z.date({
                error: (issue) =>
                    issue.input === undefined
                        ? "Kies een startdatum voor het perceel"
                        : undefined,
            }),
        ),
        b_end: z.coerce.date().nullable().optional(),
        b_bufferstrip: z.boolean().optional(),
    })
    .refine(
        (schema) => {
            if (schema.b_start && schema.b_end) {
                return schema.b_end > schema.b_start
            }
            return true
        },
        {
            path: ["b_end"],
            error: "Einddatum moet na de startdatum zijn",
        },
    )
