import type { SavedReplyContext } from "@nmi-agro/fdm-helpdesk"
import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useState } from "react"
import { Controller, type Resolver } from "react-hook-form"
import { Form, useFetcher, useNavigation } from "react-router"
import { RemixFormProvider, useRemixForm } from "remix-hook-form"
import z from "zod"
import { Button } from "~/components/ui/button"
import { Checkbox } from "~/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldLabel } from "~/components/ui/field"
import { Input } from "~/components/ui/input"
import { Spinner } from "~/components/ui/spinner"
import { Textarea } from "~/components/ui/textarea"
import { CreateSavedReplySchema } from "./saved-reply-schema"

const FormSchema = CreateSavedReplySchema.extend({
  intent: z.literal("create_saved_reply"),
})

export function CreateSavedReplyDialog({
  body,
  context,
  isInternal,
}: {
  body: string
  context?: SavedReplyContext
  isInternal: boolean
}) {
  const makeSavedReplyFetcher = useFetcher()
  const navigation = useNavigation()

  const [dialogOpen, setDialogOpen] = useState(false)

  const form = useRemixForm({
    mode: "onTouched",
    resolver: zodResolver(FormSchema) as Resolver<z.infer<typeof FormSchema>>,
    stringifyAllValues: false,
    defaultValues: {
      intent: "create_saved_reply",
      title: "",
      body: "",
    },
  })

  // biome-ignore lint/correctness/useExhaustiveDependencies: if a different message is rendered into the component, the dialog should close
  useEffect(() => {
    setDialogOpen(false)
  }, [body])

  useEffect(() => {
    if (navigation.state === "loading") {
      setDialogOpen(false)
    }
  })

  useEffect(() => {
    if (typeof makeSavedReplyFetcher.data?.body === "string") {
      form.setValue("title", "")
      form.setValue("body", makeSavedReplyFetcher.data.body)
      setDialogOpen(true)
    }
  }, [form.setValue, makeSavedReplyFetcher.data])

  const isSubmitting = navigation.state === "submitting"
  const isMakingSavedReply = makeSavedReplyFetcher.state === "submitting"

  return (
    <>
      <makeSavedReplyFetcher.Form method="post">
        <input type="hidden" name="body" value={body} />
        {Object.entries(context ?? {}).map(([key, value]) => (
          <input key={key} type="hidden" name={key} value={value} />
        ))}
        <Button
          type="submit"
          name="intent"
          value="make_saved_reply"
          variant="outline"
          disabled={isMakingSavedReply || isSubmitting}
          className="invisible group-hover/message:visible"
        >
          Maak een sjabloon
          {isMakingSavedReply && <Spinner />}
        </Button>
      </makeSavedReplyFetcher.Form>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="space-y-4 sm:max-w-lg">
          <RemixFormProvider {...form}>
            <Form method="post" onSubmit={form.handleSubmit}>
              <fieldset disabled={isSubmitting} className="space-y-4">
                <DialogHeader>
                  <DialogTitle>Nieuwe sjabloon</DialogTitle>
                  <DialogDescription>
                    Maak een nieuwe opgeslagen reactie aan die je later kunt gebruiken bij het
                    beantwoorden van tickets.
                  </DialogDescription>
                </DialogHeader>
                {isInternal && (
                  <p className="rounded-lg border border-orange-200 dark:border-orange-900/40">
                    Let op: dit antwoord kan interne notities bevatten. Zorg ervoor dat u deze niet
                    meeneemt wanneer u de sjabloon gebruikt.
                  </p>
                )}
                <Controller
                  name="title"
                  render={({ field, fieldState }) => (
                    <Field>
                      <FieldLabel>Titel</FieldLabel>
                      <FieldDescription>Geef een titel voor de sjabloon.</FieldDescription>
                      <Input {...field} />
                      {fieldState.error ? <FieldError errors={[fieldState.error]} /> : undefined}
                    </Field>
                  )}
                />
                <Controller
                  name="body"
                  render={({ field, fieldState }) => (
                    <Field>
                      <FieldLabel>Sjabloontext</FieldLabel>
                      <FieldDescription>
                        Je kunt de sjabloon hier bewerken. &#123;&#123;customer_name&#125;&#125;,
                        &#123;&#123;agent_name&#125;&#125;, &#123;&#123;farm_name&#125;&#125;,
                        &#123;&#123;ticket_ref&#125;&#125; kunnen als plaatsaanduidingen voor de
                        corresponderende waarden worden gebruikt.
                      </FieldDescription>
                      <Textarea {...field} />
                      {fieldState.error ? <FieldError errors={[fieldState.error]} /> : undefined}
                    </Field>
                  )}
                />
                <Controller
                  name="is_shared"
                  render={({ field, fieldState }) => (
                    <Field orientation="horizontal">
                      <FieldLabel>Deel met andere medewerkers</FieldLabel>
                      <Checkbox {...field} />
                      {fieldState.error ? <FieldError errors={[fieldState.error]} /> : undefined}
                    </Field>
                  )}
                />
              </fieldset>
              <DialogFooter>
                <Button type="submit" disabled={isSubmitting}>
                  Opslaan
                  {isSubmitting && <Spinner />}
                </Button>
              </DialogFooter>
            </Form>
          </RemixFormProvider>
        </DialogContent>
      </Dialog>
    </>
  )
}
