import { zodResolver } from "@hookform/resolvers/zod"
import { useId, useMemo, useState } from "react"
import { Controller, Resolver, useWatch } from "react-hook-form"
import { NavLink, useFetcher } from "react-router"
import { RemixFormProvider, useRemixForm } from "remix-hook-form"
import z from "zod"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "~/components/ui/card"
import { Checkbox } from "~/components/ui/checkbox"
import { Field, FieldDescription, FieldError, FieldLabel } from "~/components/ui/field"
import { Input } from "~/components/ui/input"
import { Spinner } from "~/components/ui/spinner"
import { Textarea } from "~/components/ui/textarea"
import { CreateSavedReplySchema, FdmSavedReplyContext } from "./saved-reply-schema"

export function SavedReplyEditor({
  reply,
  canModify,
}: {
  reply?: Partial<Omit<z.infer<typeof CreateSavedReplySchema>, "intent">>
  canModify: boolean
}) {
  const fetcher = useFetcher()
  const isSubmitting = fetcher.state !== "idle"

  const [savedReplyContext, setSavedReplyContext] = useState<FdmSavedReplyContext>({
    agent_name: "Smith",
    customer_name: "John Doe",
    farm_name: "Boerderij",
    ticket_ref: "TK-1B57C9",
  })

  const form = useRemixForm({
    mode: "onTouched",
    resolver: zodResolver(CreateSavedReplySchema) as Resolver<
      z.infer<typeof CreateSavedReplySchema>
    >,
    fetcher: fetcher,
    stringifyAllValues: false,
    defaultValues: {
      intent: "create_saved_reply",
      title: reply?.title ?? "",
      body: reply?.body ?? "",
      is_shared: reply?.is_shared ?? false,
    },
  })

  const body = useWatch({ name: "body", control: form.control })

  const usedPlaceholders = useMemo(
    () =>
      (["agent_name", "customer_name", "farm_name", "ticket_ref"] as const).filter((x) =>
        body.includes(`{${x}}`),
      ),
    [body],
  )

  const placeholderId = useId()

  return (
    <RemixFormProvider {...form}>
      <div className="flex w-full min-w-0 flex-col items-start gap-4 p-4 md:flex-row">
        <Card className="min-w-0 flex-1">
          <fetcher.Form method="post" onSubmit={form.handleSubmit}>
            <CardHeader>
              <CardTitle>{canModify ? "Het sjabloon bijwerken" : "Bekijk het sjabloon"}</CardTitle>
            </CardHeader>
            <CardContent>
              <fieldset disabled={isSubmitting || !canModify} className="space-y-4">
                <Controller
                  name="title"
                  render={({ field, fieldState }) => (
                    <Field>
                      <FieldLabel>Titel</FieldLabel>
                      {canModify && (
                        <FieldDescription>Geef een titel voor de sjabloon.</FieldDescription>
                      )}
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
                      {canModify && (
                        <FieldDescription>
                          Je kunt de sjabloon hier bewerken. &#123;&#123;customer_name&#125;&#125;,
                          &#123;&#123;agent_name&#125;&#125;, &#123;&#123;farm_name&#125;&#125;,
                          &#123;&#123;ticket_ref&#125;&#125; kunnen als plaatsaanduidingen voor de
                          corresponderende waarden worden gebruikt.
                        </FieldDescription>
                      )}
                      <Textarea {...field} rows={10} placeholder="Schrijf hier de sjabloontext." />
                      {fieldState.error ? <FieldError errors={[fieldState.error]} /> : undefined}
                    </Field>
                  )}
                />
                <Controller
                  name="is_shared"
                  render={({ field, fieldState }) => (
                    <Field orientation="horizontal">
                      <FieldLabel>
                        {canModify ? "Deel" : "Gedeeld"} met andere medewerkers
                      </FieldLabel>
                      <Checkbox
                        name={field.name}
                        onBlur={field.onBlur}
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                      {fieldState.error ? <FieldError errors={[fieldState.error]} /> : undefined}
                    </Field>
                  )}
                />
              </fieldset>
            </CardContent>
            <CardFooter className="justify-end gap-2">
              <Button variant="outline" asChild>
                <NavLink to="../.">Terug</NavLink>
              </Button>
              {canModify && (
                <Button type="submit" disabled={isSubmitting || !canModify}>
                  Opslaan
                  {isSubmitting && <Spinner />}
                </Button>
              )}
            </CardFooter>
          </fetcher.Form>
        </Card>
        <Card className="min-w-0 flex-1">
          <CardHeader>
            <CardTitle>Voorbeeld</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pb-4">
            <Field>
              <FieldLabel>Gebruikte plaatsaanduidingen:</FieldLabel>
              <div className="flex flex-col flex-wrap gap-2 lg:flex-row lg:flex-nowrap">
                {usedPlaceholders.length > 0 ? (
                  usedPlaceholders.map((placeholder) => (
                    <Field key={placeholder} orientation="horizontal" className="flex-initial">
                      <FieldLabel
                        htmlFor={`${placeholderId}_placeholder`}
                        className="text-muted-foreground"
                      >
                        &#123;&#123;{placeholder}&#125;&#125;
                      </FieldLabel>
                      <Input
                        id={`${placeholderId}_placeholder`}
                        name={placeholder}
                        value={savedReplyContext?.[placeholder] ?? ""}
                        size={20}
                        onChange={(e) =>
                          setSavedReplyContext((prev) => ({
                            ...prev,
                            [placeholder]: e.target?.value ?? "",
                          }))
                        }
                      />
                    </Field>
                  ))
                ) : (
                  <span className="text-muted-foreground">Geen</span>
                )}
              </div>
            </Field>
            <Field>
              <FieldLabel>Resultaat:</FieldLabel>
              <div className="border-muted rounded-md border p-2 text-sm whitespace-pre-wrap">
                {usedPlaceholders.reduce(
                  (result, expr) =>
                    result.replaceAll(`{{${expr}}}`, savedReplyContext[expr] ?? `{{${expr}}}`),
                  body,
                )}
              </div>
            </Field>
          </CardContent>
        </Card>
      </div>
    </RemixFormProvider>
  )
}
