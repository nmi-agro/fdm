import { zodResolver } from "@hookform/resolvers/zod"
import { Controller } from "react-hook-form"
import { Form } from "react-router"
import { RemixFormProvider, useRemixForm } from "remix-hook-form"
import type z from "zod"
import { Button } from "~/components/ui/button"
import {
    Field,
    FieldContent,
    FieldError,
    FieldLabel,
} from "~/components/ui/field"
import { Textarea } from "~/components/ui/textarea"
import { MessageSchema } from "./message-schema"

export function MessageComposer({ intent }: { intent: string }) {
    const form = useRemixForm<z.infer<typeof MessageSchema>>({
        mode: "onTouched",
        resolver: zodResolver(MessageSchema),
        defaultValues: {
            intent: intent,
        },
    })

    return (
        <RemixFormProvider {...form}>
            <Form method="post" onSubmit={form.handleSubmit}>
                {typeof intent === "string" && (
                    <input type="hidden" name="intent" value={intent} />
                )}
                <Controller
                    name="body"
                    render={({ field, fieldState }) => (
                        <Field>
                            <FieldLabel>Schrijf beneden</FieldLabel>
                            <FieldContent>
                                <Textarea {...field} />
                                <FieldError errors={[fieldState.error]} />
                            </FieldContent>
                        </Field>
                    )}
                />
                <Button type="submit">Verzenden</Button>
            </Form>
        </RemixFormProvider>
    )
}
