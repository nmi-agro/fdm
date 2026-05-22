import { zodResolver } from "@hookform/resolvers/zod"
import { Controller } from "react-hook-form"
import { Form } from "react-router"
import { RemixFormProvider, useRemixForm } from "remix-hook-form"
import type z from "zod"
import type { FarmOptions } from "~/components/blocks/farm/farm"
import { Button } from "~/components/ui/button"
import { Field, FieldError, FieldLabel } from "~/components/ui/field"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "~/components/ui/select"
import { MessageFields } from "./message-composer"
import { TicketSchema } from "./ticket-schema"

export function TicketComposer({
    farmOptions,
    initial_context_farm_id,
}: {
    farmOptions: FarmOptions
    initial_context_farm_id?: string | null
}) {
    const form = useRemixForm<z.infer<typeof TicketSchema>>({
        mode: "onTouched",
        resolver: zodResolver(TicketSchema),
        defaultValues: {
            context_farm_id: initial_context_farm_id,
        },
    })

    return (
        <RemixFormProvider {...form}>
            <Form method="POST">
                <Controller
                    name="context_farm_id"
                    render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                            <FieldLabel>Mijn vraag is over...</FieldLabel>
                            <Select
                                value={field.value ?? "NO_SELECTION"}
                                onValueChange={(value) => {
                                    form.setValue(
                                        "context_farm_id",
                                        value === "NO_SELECTION" ? null : value,
                                    )
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {[
                                        <SelectItem key="" value="NO_SELECTION">
                                            (Geen uit mijn bedrijven)
                                        </SelectItem>,
                                    ].concat(
                                        (farmOptions ?? []).map((opt) => (
                                            <SelectItem
                                                key={opt.b_id_farm}
                                                value={opt.b_id_farm}
                                            >
                                                {opt.b_name_farm}
                                            </SelectItem>
                                        )),
                                    )}
                                </SelectContent>
                            </Select>
                            <FieldError errors={[fieldState.error]} />
                        </Field>
                    )}
                />
                <MessageFields />
                <Button type="submit" className="ms-auto">
                    Verzenden
                </Button>
            </Form>
        </RemixFormProvider>
    )
}
