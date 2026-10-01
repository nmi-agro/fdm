import type z from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRef } from "react"
import { Controller } from "react-hook-form"
import { NavLink, useSubmit } from "react-router"
import { RemixFormProvider, useRemixForm } from "remix-hook-form"
import type { FarmOptions } from "~/components/blocks/farm/farm"
import { Button } from "~/components/ui/button"
import { Card, CardContent } from "~/components/ui/card"
import { Field, FieldDescription, FieldError, FieldLabel, FieldTitle } from "~/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import { Textarea } from "~/components/ui/textarea"
import { ALLOWED_ATTACHMENT_EXTENSIONS, MAX_ATTACHMENT_SIZE, MAX_ATTACHMENTS } from "~/lib/upload-utils"
import { AttachmentDropzone } from "./attachment-dropzone"
import { TicketSchema } from "./ticket-schema"

export function TicketComposer({
  farmOptions,
  initial_context_farm_id,
}: {
  farmOptions: FarmOptions
  initial_context_farm_id?: string | null
}) {
  const submit = useSubmit()
  const formRef = useRef<HTMLFormElement>(null)

  const form = useRemixForm<z.infer<typeof TicketSchema>>({
    mode: "onTouched",
    resolver: zodResolver(TicketSchema),
    stringifyAllValues: false,
    defaultValues: {
      context_farm_id: initial_context_farm_id,
    },
    submitHandlers: {
      onValid() {
        if (!formRef.current) return
        submit(new FormData(formRef.current), {
          method: "POST",
          encType: "multipart/form-data",
        })
      },
    },
  })

  return (
    <RemixFormProvider {...form}>
      <form
        ref={formRef}
        method="post"
        encType="multipart/form-data"
        className="mx-auto max-w-5xl space-y-6"
        onSubmit={form.handleSubmit}
      >
        <Card>
          <CardContent className="space-y-4 pt-6">
            <Controller
              name="context_farm_id"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel>Mijn vraag gaat over</FieldLabel>
                  <FieldDescription>
                    Selecteer het bedrijf waarop uw vraag betrekking heeft. Dit helpt onze
                    medewerkers uw vraag sneller te beantwoorden. Kies{" "}
                    <em>Geen specifiek bedrijf</em> als uw vraag niet aan één bedrijf is gekoppeld.
                  </FieldDescription>
                  <Select
                    value={field.value ?? "NO_SELECTION"}
                    onValueChange={(value) => {
                      field.onChange(value === "NO_SELECTION" ? null : value)
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[
                        <SelectItem key="" value="NO_SELECTION">
                          Geen specifiek bedrijf
                        </SelectItem>,
                      ].concat(
                        (farmOptions ?? []).map((opt) => (
                          <SelectItem key={opt.b_id_farm} value={opt.b_id_farm}>
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
                <Field>
                  <FieldLabel>Uw vraag of probleem</FieldLabel>
                  <FieldDescription>
                    Omschrijf uw vraag zo duidelijk mogelijk. Vermeld welk perceel, gewas of functie
                    het betreft en welke stappen u al heeft geprobeerd.
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
            <Controller
              name="attachments"
              render={({ field }) => {
                return (
                  <Field>
                    <FieldTitle>Bijlagen</FieldTitle>
                    <FieldDescription>
                      Voeg enkele afbeeldingen en andere bestanden toe die je vraag ondersteunen.
                    </FieldDescription>
                    <AttachmentDropzone
                      name={"attachments"}
                      accept={ALLOWED_ATTACHMENT_EXTENSIONS}
                      maxSize={MAX_ATTACHMENT_SIZE}
                      maxFiles={MAX_ATTACHMENTS}
                      value={field.value}
                      onFilesChange={field.onChange}
                    />
                  </Field>
                )
              }}
            />
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button variant="outline" asChild>
                <NavLink to="/support">Annuleren</NavLink>
              </Button>
              <Button type="submit">Verzenden</Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </RemixFormProvider>
  )
}
