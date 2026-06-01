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
import { Textarea } from "~/components/ui/textarea"
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
        stringifyAllValues: false,
        defaultValues: {
            context_farm_id: initial_context_farm_id,
        },
    })

    return (
        <RemixFormProvider {...form}>
            <Form method="post">
                <Controller
                    name="context_farm_id"
                    render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                            <FieldLabel>Mijn vraag is over...</FieldLabel>
                            <Select
                                value={field.value ?? "NO_SELECTION"}
                                onValueChange={(value) => {
                                    field.onChange(
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
                <Controller
                    name="body"
                    render={({ field, fieldState }) => (
                        <Field className="pb-4">
                            <FieldLabel>Stel je vraag beneden.</FieldLabel>
                            <Textarea
                                {...field}
                                rows={5}
                                placeholder="Beschrijf je vraag of probleem zo duidelijk mogelijk.&#10;&#10;Vermeld welk perceel, gewas of functie het betreft."
                            />
                            <FieldError errors={[fieldState.error]} />
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
