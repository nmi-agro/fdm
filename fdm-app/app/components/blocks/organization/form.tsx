import { zodResolver } from "@hookform/resolvers/zod"
import { Building, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Controller } from "react-hook-form"
import { useFetcher, type HTMLFormMethod } from "react-router"
import { RemixFormProvider, useRemixForm } from "remix-hook-form"
import z from "zod"
import type { ParsedOrganization } from "~/lib/organization-helpers"
import {
  MAX_SIZE_BYTES,
  ProfilePictureInput,
} from "~/components/blocks/profile/profile-picture-manager"
import { Button } from "~/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card"
import { Field, FieldError, FieldLabel } from "~/components/ui/field"
import { Input } from "~/components/ui/input"
import { Spinner } from "~/components/ui/spinner"
import { Textarea } from "~/components/ui/textarea"
import { OrganizationInfoSchema } from "./schema"

const FormSchema = OrganizationInfoSchema.extend({ intent: z.literal("update_organization_info") })
export function OrganizationSettingsForm({
  className,
  organization,
  action,
  method = "POST",
  canModify,
  profilePictureField,
}: {
  className?: string
  organization?: ParsedOrganization
  action?: string
  method?: HTMLFormMethod
  canModify: boolean
  profilePictureField: boolean
}) {
  const fetcher = useFetcher()

  const [profilePictureFiles, setProfilePictureFiles] = useState<File[]>([])

  const formRef = useRef<HTMLFormElement>(null)
  const form = useRemixForm({
    mode: "onTouched",
    resolver: zodResolver(FormSchema),
    fetcher: fetcher,
    stringifyAllValues: false,
    submitHandlers: {
      onValid() {
        if (formRef.current) {
          fetcher.submit(new FormData(formRef.current), {
            method: "post",
            encType: "multipart/form-data",
          })
        }
      },
    },
    defaultValues: {
      intent: "update_organization_info" as const,
      name: organization?.name,
      slug: organization?.slug,
      description: organization?.metadata?.data?.description,
    },
  })

  // Function to convert text to a slug
  const convertToSlug = (text: string) => {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-") // Replace non-alphanumeric with -
      .replace(/--+/g, "-") // Replace multiple - with single -
      .replace(/^-|-$/g, "") // Trim - from start and end
  }

  // Reset the form when the organization changes
  useEffect(() => {
    form.reset({
      intent: "update_organization_info" as const,
      name: organization?.name,
      slug: organization?.slug,
      description: organization?.metadata?.data?.description,
    })
    setProfilePictureFiles([])
  }, [form.reset, !!organization, organization?.slug])

  // Update slug when name changes
  const organizationName = form.getValues("name")

  useEffect(() => {
    if (!organizationName) return
    const newSlug = convertToSlug(organizationName)
    if (form.getValues("slug") !== newSlug) {
      form.setValue("slug", newSlug)
    }
  }, [organizationName, form.getValues, form.setValue])

  const isSubmitting = fetcher.state !== "idle"
  const disabled = !canModify || isSubmitting
  return (
    <Card className={className}>
      <RemixFormProvider {...form}>
        <fetcher.Form ref={formRef} action={action} method={method} onSubmit={form.handleSubmit}>
          <CardHeader>
            <CardTitle>Organisatiegegevens</CardTitle>
            <CardDescription>Voer de gegevens van je organisatie in.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <fieldset disabled={disabled} className="space-y-4">
              <input type="hidden" name="intent" value="update_organization_info" />
              <Controller
                name="name"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel>Naam organisatie</FieldLabel>
                    <Input {...field} value={field.value ?? ""} type="text" required />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              <Controller
                name="slug"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel>Organisatie ID</FieldLabel>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      type="text"
                      readOnly
                      className="text-muted-foreground pointer-events-none"
                    />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              <Controller
                name="description"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel>Beschrijving</FieldLabel>
                    <Textarea
                      placeholder="Een korte toelichting op je organisatie zodat andere gebruikers er meer te weten over komen."
                      className="resize-none"
                      {...field}
                      value={field.value ?? ""}
                    />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              {profilePictureField && (
                <Field>
                  <FieldLabel>Logo (optioneel)</FieldLabel>
                  <div className="relative mx-auto max-w-sm">
                    <ProfilePictureInput
                      appAspectRatio={3 / 2}
                      files={profilePictureFiles}
                      onFilesChange={setProfilePictureFiles}
                      maxFileSize={MAX_SIZE_BYTES}
                      avatarFallback={<Building />}
                    />
                    {profilePictureFiles.length > 0 ? (
                      <Button
                        variant="ghost"
                        onClick={() => setProfilePictureFiles([])}
                        className="hover:text-destructive absolute top-2 right-2 size-auto text-gray-100 has-[>svg]:px-1 has-[>svg]:py-1"
                        title="Logo verwijderen"
                        aria-label="Logo verwijderen"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                </Field>
              )}
            </fieldset>
          </CardContent>
          <CardFooter className="flex-row justify-end">
            <Button type="submit" disabled={disabled}>
              {isSubmitting && <Spinner />}
              {organization ? "Bijwerken" : "Aanmaken"}
            </Button>
          </CardFooter>
        </fetcher.Form>
      </RemixFormProvider>
    </Card>
  )
}
