import { zodResolver } from "@hookform/resolvers/zod"
import type { TagSummary } from "@nmi-agro/fdm-helpdesk"
import { useEffect } from "react"
import { Controller } from "react-hook-form"
import type { FetcherWithComponents } from "react-router"
import { RemixFormProvider, useRemixForm } from "remix-hook-form"
import z from "zod"
import { Button } from "~/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import { Field, FieldError, FieldLabel } from "~/components/ui/field"
import { Input } from "~/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger } from "~/components/ui/select"
import { Spinner } from "~/components/ui/spinner"
import { TagSchema } from "./tag-schema"

export const DEFAULT_TAG_COLOR = "#6b7280"
export const DEFAULT_TAG_COLOR_LABEL = "Grijs"

// From GitHub
export const SWATCH = [
  {
    value: "#b60205",
    label: "Rood",
  },
  {
    value: "#d47126",
    label: "Oranje",
  },
  {
    value: "#fbca04",
    label: "Geel",
  },
  {
    value: "#0e8a16",
    label: "Groen",
  },
  {
    value: "#006b75",
    label: "Teal",
  },
  {
    value: "#1d85db",
    label: "Blauw",
  },
  {
    value: "#0052cc",
    label: "Indigo",
  },
  {
    value: "#5319e7",
    label: "Paars",
  },
  {
    value: "#e99695",
    label: "Rose",
  },
  {
    value: "#fef2c0",
    label: "Lichtgeel",
  },
  {
    value: "#c2e0c6",
    label: "Lichtgroen",
  },
  {
    value: "#bfdadc",
    label: "Lichtteal",
  },
  {
    value: "#c5def5",
    label: "Lichtblauw",
  },
  {
    value: "#d4c5f9",
    label: "Lila",
  },
  {
    value: DEFAULT_TAG_COLOR,
    label: DEFAULT_TAG_COLOR_LABEL,
  },
]

export function TagCreator({
  fetcher,
  availableTags,
  intent,
  dialogOpen,
  setDialogOpen,
}: {
  fetcher: FetcherWithComponents<unknown>
  availableTags: TagSummary[]
  intent: string
  dialogOpen: boolean
  setDialogOpen: (open: boolean) => void
}) {
  const currentColors = new Set(availableTags.map((tag) => tag.color))
  const unusedColor = SWATCH.find((color) => !currentColors.has(color.value))

  const form = useRemixForm({
    mode: "onTouched",
    resolver: zodResolver(TagSchema.extend({ intent: z.literal(intent) })),
    defaultValues: {
      intent: intent,
      color: unusedColor?.value,
    },
  })

  // Close the dialog when tag creation succeeds
  useEffect(() => {
    if (form.formState.isSubmitSuccessful) {
      setDialogOpen(false)
    }
  }, [form.formState.isSubmitSuccessful, setDialogOpen])

  // Rrset the form if the list of available tags changes (so usually when a new tag is created)
  useEffect(() => {
    const currentColors = new Set(availableTags.map((tag) => tag.color))
    const unusedColor = SWATCH.find((color) => !currentColors.has(color.value))
    form.reset({
      intent: intent,
      color: unusedColor?.value,
    })
  }, [intent, availableTags, form.reset])

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nieuwe tag aanmaken</DialogTitle>
          <DialogDescription>Kies een naam en kleur voor jouw nieuwe tag.</DialogDescription>
        </DialogHeader>
        <RemixFormProvider {...form}>
          <fetcher.Form method="POST" onSubmit={form.handleSubmit} className="space-y-4">
            <Controller
              name="name"
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel>Naam</FieldLabel>
                  <Input
                    type="text"
                    placeholder="Naam voor deze tag"
                    {...field}
                    value={field.value ?? ""}
                  />
                  {fieldState.error && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              name="description"
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel>Omschrijving</FieldLabel>
                  <Input
                    type="text"
                    placeholder="Optioneel een omschrijving toevoegen"
                    {...field}
                  />
                  {fieldState.error && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              name="color"
              render={({ field, fieldState }) => {
                const activeOption =
                  SWATCH.find((color) => color.value === field.value) ??
                  (field.value
                    ? {
                        value: field.value,
                        label: field.value,
                      }
                    : null)
                return (
                  <Field>
                    <FieldLabel>Kleur</FieldLabel>
                    <Select value={field.value} onValueChange={(value) => field.onChange(value)}>
                      <SelectTrigger className="text-start gap-2">
                        {activeOption ? (
                          <>
                            <div
                              className="size-4 rounded-sm"
                              style={{
                                backgroundColor: activeOption.value,
                              }}
                            />
                            <div className="grow">{activeOption.label}</div>
                          </>
                        ) : (
                          <span className="text-muted-foreground">Geen kleur geselecteerd</span>
                        )}
                      </SelectTrigger>
                      <SelectContent>
                        {SWATCH.map((color) => (
                          <SelectItem key={color.value} value={color.value}>
                            <div className="flex flex-row items-center gap-2">
                              <div
                                className="size-4 rounded-sm"
                                style={{
                                  backgroundColor: color.value,
                                }}
                              />
                              {color.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )
              }}
            />
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Terug
                </Button>
              </DialogClose>
              <Button type="submit" disabled={fetcher.state !== "idle"}>
                {fetcher.state !== "idle" ? (
                  <>
                    Opslaan...
                    <Spinner />
                  </>
                ) : (
                  "Opslaan"
                )}
              </Button>
            </DialogFooter>
          </fetcher.Form>
        </RemixFormProvider>
      </DialogContent>
    </Dialog>
  )
}
