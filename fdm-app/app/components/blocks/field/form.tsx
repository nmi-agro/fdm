import type { Feature, Polygon } from "geojson"
import type { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useMemo } from "react"
import { Controller } from "react-hook-form"
import { Form } from "react-router"
import { RemixFormProvider, useRemixForm } from "remix-hook-form"
import { Button } from "~/components/ui/button"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  createComboboxItems,
} from "~/components/ui/combobox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import { Field, FieldContent, FieldError, FieldLabel } from "~/components/ui/field"
import { Input } from "~/components/ui/input"
import { Spinner } from "~/components/ui/spinner"
import { FormSchema } from "./schema"

interface FieldDetailsDialogProps {
  open: boolean
  setOpen: (value: boolean) => void
  field: Feature<Polygon>
  cultivationOptions: { value: string; label: string }[]
  fieldNameDefault: string
}

export default function FieldDetailsDialog({
  open,
  setOpen,
  field,
  cultivationOptions,
  fieldNameDefault,
}: FieldDetailsDialogProps) {
  const b_lu_catalogue = field.properties?.b_lu_catalogue ?? ""

  const form = useRemixForm<z.infer<typeof FormSchema>>({
    mode: "onTouched",
    resolver: zodResolver(FormSchema),
    defaultValues: {
      b_name: fieldNameDefault,
      b_lu_catalogue: b_lu_catalogue,
    },
    submitData: {
      b_id_source: field.properties?.b_id_source,
      b_geometry: JSON.stringify(field.geometry),
    },
  })

  const cultivationItems = useMemo(
    () =>
      createComboboxItems(cultivationOptions, {
        getValue: (option) => option.value,
        getLabel: (option) => option.label,
      }),
    [cultivationOptions],
  )

  const formIsSubmitSuccessful = form.formState.isSubmitSuccessful
  const formReset = form.reset
  useEffect(() => {
    if (formIsSubmitSuccessful || !open) {
      formReset()
    }
  }, [formIsSubmitSuccessful, formReset, open])

  // Effect to update form values when the 'field' prop changes
  useEffect(() => {
    formReset({
      b_name: fieldNameDefault,
      b_lu_catalogue: b_lu_catalogue,
    })
  }, [formReset, fieldNameDefault, b_lu_catalogue, form.reset])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <RemixFormProvider {...form}>
          <Form id="formField" onSubmit={form.handleSubmit} method="post">
            <fieldset disabled={form.formState.isSubmitting}>
              <DialogHeader>
                <DialogTitle>Nieuw perceel</DialogTitle>
                <DialogDescription>Vul de details van dit perceel in</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <Controller
                  name="b_name"
                  render={({ field, fieldState }) => (
                    <Field>
                      <FieldLabel>Naam</FieldLabel>
                      <FieldContent>
                        <Input
                          {...field}
                          type="text"
                          required
                          disabled={form.formState.isSubmitting}
                        />
                      </FieldContent>
                      <FieldError errors={[fieldState.error]} />
                    </Field>
                  )}
                />
                <Controller
                  name="b_lu_catalogue"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor={field.name}>
                        Hoofdgewas
                        <span className="text-red-500">*</span>
                      </FieldLabel>
                      <FieldContent>
                        <Combobox
                          items={cultivationItems}
                          value={field.value || null}
                          onValueChange={(value) => field.onChange(value ?? "")}
                        >
                          <ComboboxInput
                            id={field.name}
                            onBlur={field.onBlur}
                            aria-invalid={fieldState.invalid}
                          />
                          <ComboboxContent>
                            <ComboboxEmpty>Geen gewassen gevonden.</ComboboxEmpty>
                            <ComboboxList>
                              {(item) => (
                                <ComboboxItem key={item.value} value={item.value}>
                                  {item.label}
                                </ComboboxItem>
                              )}
                            </ComboboxList>
                          </ComboboxContent>
                        </Combobox>
                      </FieldContent>
                      <FieldError errors={[fieldState.error]} />
                    </Field>
                  )}
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? (
                    <div className="flex items-center space-x-2">
                      <Spinner />
                      <span>Opslaan...</span>
                    </div>
                  ) : (
                    <span>Opslaan</span>
                  )}
                </Button>
              </DialogFooter>
            </fieldset>
          </Form>
        </RemixFormProvider>
      </DialogContent>
    </Dialog>
  )
}
