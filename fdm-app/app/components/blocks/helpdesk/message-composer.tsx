import { zodResolver } from "@hookform/resolvers/zod"
import { Controller } from "react-hook-form"
import { Form } from "react-router"
import { RemixFormProvider, useRemixForm } from "remix-hook-form"
import type z from "zod"
import { Button } from "~/components/ui/button"
import { Field, FieldError, FieldLabel } from "~/components/ui/field"
import { Textarea } from "~/components/ui/textarea"
import { TicketSchema } from "./ticket-schema"

export function MessageComposer({
    label = "Shrijf je vraag beneden",
    intent,
    message_id,
    is_internal,
}: {
    label?: string
    intent?: string
    message_id?: string
    is_internal?: boolean
}) {
    const form = useRemixForm<z.infer<typeof TicketSchema>>({
        mode: "onTouched",
        resolver: zodResolver(TicketSchema),
    })

    return (
        <RemixFormProvider {...form}>
            <Form
                method="POST"
                className="space-y-4"
                onSubmit={form.handleSubmit}
            >
                {typeof intent === "string" && (
                    <input type="hidden" name="intent" value={intent} />
                )}
                {typeof message_id === "string" && (
                    <input type="hidden" name="message_id" value={message_id} />
                )}
                {typeof is_internal === "boolean" && (
                    <input
                        type="hidden"
                        name="is_internal"
                        value={is_internal ? "true" : "false"}
                    />
                )}
                <Controller
                    name="body"
                    render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                            <FieldLabel>{label}</FieldLabel>
                            <Textarea {...field} />
                            <FieldError />
                        </Field>
                    )}
                />
                <Button type="submit" className="ms-auto">
                    Verzenden
                </Button>
            </Form>
        </RemixFormProvider>
    )
}
