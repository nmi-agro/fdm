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
    intent,
    message_id,
}: {
    intent?: string
    message_id?: string
}) {
    const form = useRemixForm<z.infer<typeof TicketSchema>>({
        mode: "onTouched",
        resolver: zodResolver(TicketSchema),
    })

    return (
        <RemixFormProvider {...form}>
            <Form method="POST">
                {typeof intent === "string" && (
                    <input type="hidden" name="intent" value={intent} />
                )}
                {typeof message_id === "string" && (
                    <input type="hidden" name="message_id" value={message_id} />
                )}
                <MessageFields />
                <Button type="submit" className="ms-auto">
                    Verzenden
                </Button>
            </Form>
        </RemixFormProvider>
    )
}

export function MessageFields() {
    return (
        <Controller
            name="body"
            render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                    <FieldLabel>Shrijf je vraag beneden</FieldLabel>
                    <Textarea {...field} />
                    <FieldError errors={[fieldState.error]} />
                </Field>
            )}
        />
    )
}
