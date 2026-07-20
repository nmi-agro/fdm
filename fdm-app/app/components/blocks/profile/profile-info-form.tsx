import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect } from "react"
import { Controller } from "react-hook-form"
import { Form, useFetcher } from "react-router"
import { RemixFormProvider, useRemixForm } from "remix-hook-form"
import z from "zod"
import { Button } from "~/components/ui/button"
import { Field, FieldError, FieldLabel } from "~/components/ui/field"
import { Input } from "~/components/ui/input"
import { Spinner } from "~/components/ui/spinner"
import { ProfileInfoSchema } from "./profile-info-schema"

const InfoFormSchema = ProfileInfoSchema.extend({ intent: z.literal("update_profile_info") })
export function ProfileInfoForm({
  user,
}: {
  user: { firstname?: string | null | undefined; surname?: string | null | undefined }
}) {
  const fetcher = useFetcher()

  const isSubmitting = fetcher.state !== "idle"

  const form = useRemixForm({
    mode: "onTouched",
    resolver: zodResolver(InfoFormSchema),
    fetcher: fetcher,
    stringifyAllValues: false,
    defaultValues: {
      intent: "update_profile_info" as const,
      firstname: user.firstname ?? "",
      surname: user.surname ?? "",
    },
  })

  useEffect(() => {
    form.reset({
      intent: "update_profile_info" as const,
      firstname: user.firstname ?? "",
      surname: user.surname ?? "",
    })
  }, [user, form.reset])

  return (
    <RemixFormProvider {...form}>
      <Form method="post" onSubmit={form.handleSubmit} className="space-y-6">
        <fieldset disabled={isSubmitting} className="space-y-4">
          <input type="hidden" name="intent" value="update_profile_info" />
          <Controller
            name="firstname"
            render={({ field, fieldState }) => (
              <Field>
                <FieldLabel>Voornaam</FieldLabel>
                <Input {...field} type="text" />
                {fieldState.error && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          <Controller
            name="surname"
            render={({ field, fieldState }) => (
              <Field>
                <FieldLabel>Achternaam</FieldLabel>
                <Input {...field} type="text" />
                {fieldState.error && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
        </fieldset>
        <div className="flex flex-row items-center justify-end gap-2">
          <Button type="submit" disabled={isSubmitting}>
            Opslaan{isSubmitting && <Spinner />}
          </Button>
        </div>
      </Form>
    </RemixFormProvider>
  )
}
