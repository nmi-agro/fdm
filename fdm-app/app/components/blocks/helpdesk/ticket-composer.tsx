import { zodResolver } from "@hookform/resolvers/zod"
import { Controller } from "react-hook-form"
import { Form, NavLink } from "react-router"
import { RemixFormProvider, useRemixForm } from "remix-hook-form"
import type z from "zod"
import type { FarmOptions } from "~/components/blocks/farm/farm"
import { Button } from "~/components/ui/button"
import { Card, CardContent } from "~/components/ui/card"
import {
    Field,
    FieldDescription,
    FieldError,
    FieldLabel,
} from "~/components/ui/field"
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
            <Form method="post" className="mx-auto max-w-5xl space-y-6">
                <Card>
                    <CardContent className="pt-6 space-y-4">
                        <Controller
                            name="context_farm_id"
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel>
                                        Mijn vraag gaat over
                                    </FieldLabel>
                                    <FieldDescription>
                                        Selecteer het bedrijf waarop uw vraag
                                        betrekking heeft. Dit helpt onze
                                        medewerkers uw vraag sneller te
                                        beantwoorden. Kies{" "}
                                        <em>Geen specifiek bedrijf</em> als uw
                                        vraag niet aan één bedrijf is gekoppeld.
                                    </FieldDescription>
                                    <Select
                                        value={field.value ?? "NO_SELECTION"}
                                        onValueChange={(value) => {
                                            field.onChange(
                                                value === "NO_SELECTION"
                                                    ? null
                                                    : value,
                                            )
                                        }}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {[
                                                <SelectItem
                                                    key=""
                                                    value="NO_SELECTION"
                                                >
                                                    Geen specifiek bedrijf
                                                </SelectItem>,
                                            ].concat(
                                                (farmOptions ?? []).map(
                                                    (opt) => (
                                                        <SelectItem
                                                            key={opt.b_id_farm}
                                                            value={
                                                                opt.b_id_farm
                                                            }
                                                        >
                                                            {opt.b_name_farm}
                                                        </SelectItem>
                                                    ),
                                                ),
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
                                <Field>
                                    <FieldLabel>
                                        Uw vraag of probleem
                                    </FieldLabel>
                                    <FieldDescription>
                                        Omschrijf uw vraag zo duidelijk
                                        mogelijk. Vermeld welk perceel, gewas of
                                        functie het betreft en welke stappen u
                                        al heeft geprobeerd.
                                    </FieldDescription>
                                    <Textarea
                                        {...field}
                                        rows={6}
                                        placeholder="Beschrijf uw vraag of probleem hier..."
                                        data-invalid={fieldState.invalid}
                                    />
                                    <FieldError errors={[fieldState.error]} />
                                </Field>
                            )}
                        />
                        <div className="flex items-center justify-end gap-3 pt-2">
                            <Button variant="outline" asChild>
                                <NavLink to="/support">Annuleren</NavLink>
                            </Button>
                            <Button type="submit">Verzenden</Button>
                        </div>
                    </CardContent>
                </Card>
            </Form>
        </RemixFormProvider>
    )
}
