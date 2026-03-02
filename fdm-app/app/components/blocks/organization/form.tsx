import { zodResolver } from "@hookform/resolvers/zod"
import type { Organization } from "better-auth/plugins"
import { useEffect } from "react"
import { Controller } from "react-hook-form"
import { Form, type HTMLFormMethod } from "react-router"
import { RemixFormProvider, useRemixForm } from "remix-hook-form"
import { Button } from "~/components/ui/button"
import { Field, FieldError, FieldLabel } from "~/components/ui/field"
import { Input } from "~/components/ui/input"
import { Spinner } from "~/components/ui/spinner"
import { Textarea } from "~/components/ui/textarea"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import { FormSchema } from "./schema"

export function OrganizationSettingsForm({
    organization,
    action,
    method = "POST",
    canModify,
}: {
    organization?: Organization
    action?: string
    method?: HTMLFormMethod
    canModify: boolean
}) {
    const form = useRemixForm({
        mode: "onTouched",
        resolver: zodResolver(FormSchema),
        defaultValues: {
            name: organization?.name,
            slug: organization?.slug,
            description: organization?.metadata?.description,
        },
    })

    // Function to convert text to a slug
    const convertToSlug = (text: string) => {
        return text
            .toLowerCase()
            .replace(/[^a-z0-9-]+/g, "-") // Replace non-alphanumeric with -
            .replace(/--+/g, "-") // Replace multiple - with single -
            .replace(/^-|-$/g, "") // Trim - from start and end
    }

    // Reset the form when the organization changes
    useEffect(() => {
        form.reset({
            name: organization?.name,
            slug: organization?.slug,
            description: organization?.metadata?.description,
        })
    }, [organization, form.reset])

    // Update slug when name changes
    // biome-ignore lint/correctness/useExhaustiveDependencies: convertToSlug changes on every re-render and should not be used as a hook dependency
    useEffect(() => {
        const subscription = form.watch((value, { name }) => {
            if (!organization?.slug && name === "name") {
                const slug = convertToSlug(value.name ?? "")
                form.setValue("slug", slug, {
                    shouldDirty: true,
                    shouldValidate: true,
                })
            }
        })
        return () => subscription.unsubscribe()
    }, [organization?.slug, form.watch, form.setValue])

    const disabled = !canModify || form.formState.isSubmitting
    return (
        <Card className="max-w-3xl mx-auto">
            <CardHeader>
                <CardTitle>Organisatiegegevens</CardTitle>
                <CardDescription>
                    Voer de gegevens van je organisatie in.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <RemixFormProvider {...form}>
                    <Form
                        action={action}
                        method={method}
                        onSubmit={form.handleSubmit}
                    >
                        <fieldset disabled={disabled} className="space-y-4">
                            <Controller
                                name="name"
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel>
                                            Naam organisatie
                                        </FieldLabel>
                                        <Input
                                            {...field}
                                            type="text"
                                            required
                                        />
                                        {fieldState.invalid && (
                                            <FieldError
                                                errors={[fieldState.error]}
                                            />
                                        )}
                                    </Field>
                                )}
                            />
                            <Controller
                                name="slug"
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel>Organisatie ID</FieldLabel>
                                        <Input
                                            {...field}
                                            type="text"
                                            required
                                        />
                                        {fieldState.invalid && (
                                            <FieldError
                                                errors={[fieldState.error]}
                                            />
                                        )}
                                    </Field>
                                )}
                            />
                            <Controller
                                name="description"
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel>Beschrijving</FieldLabel>
                                        <Textarea
                                            placeholder="Een korte toelichting op je organisatie zodat andere gebruikers er meer te weten over komen."
                                            className="resize-none"
                                            {...field}
                                        />
                                        {fieldState.invalid && (
                                            <FieldError
                                                errors={[fieldState.error]}
                                            />
                                        )}
                                    </Field>
                                )}
                            />
                        </fieldset>
                    </Form>
                </RemixFormProvider>
            </CardContent>
            <CardFooter className="flex-row justify-end">
                <Button type="submit" disabled={disabled}>
                    {form.formState.isSubmitting && <Spinner />}
                    {organization ? "Bijwerken" : "Aanmaken"}
                </Button>
            </CardFooter>
        </Card>
    )
}
