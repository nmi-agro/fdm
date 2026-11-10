import { zodResolver } from "@hookform/resolvers/zod"
import { AlertTriangle } from "lucide-react"
import { useEffect, useMemo } from "react"
import { Controller, useWatch } from "react-hook-form"
import { Form } from "react-router"
import { RemixFormProvider, useRemixForm } from "remix-hook-form"
import { FieldDeleteDialog } from "~/components/blocks/field/delete"
import { Alert } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "~/components/ui/card"
import { Checkbox } from "~/components/ui/checkbox"
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
  Field,
  FieldLabel,
  FieldContent,
  FieldDescription,
  FieldError,
} from "~/components/ui/field"
import { Input } from "~/components/ui/input"
import { Spinner } from "~/components/ui/spinner"
import { FormSchema } from "./schema"

export function NewFieldsForm({
  b_id,
  b_name,
  b_area,
  b_lu_catalogue,
  b_bufferstrip,
  cultivationAvailabilityYear,
  cultivationOptions,
}: NewFieldsFormProps) {
  const form = useRemixForm({
    mode: "onTouched",
    resolver: zodResolver(FormSchema),
    defaultValues: {
      b_name: b_name ?? "",
      b_area: Math.round(b_area * 10) / 10,
      b_lu_catalogue: b_lu_catalogue ?? "",
      b_bufferstrip: b_bufferstrip ?? false,
    },
  })

  const formReset = form.reset
  useEffect(() => {
    formReset({
      b_name: b_name ?? "",
      b_area: Math.round(b_area * 10) / 10,
      b_lu_catalogue: b_lu_catalogue ?? "",
      b_bufferstrip: b_bufferstrip ?? false,
    })
  }, [formReset, b_name, b_area, b_lu_catalogue, b_bufferstrip])

  const cultivationItems = useMemo(
    () =>
      createComboboxItems(cultivationOptions, {
        getValue: (option) => option.value,
        getLabel: (option) => option.label,
      }),
    [cultivationOptions],
  )

  const current_b_lu_catalogue = useWatch({ control: form.control, name: "b_lu_catalogue" })
  const currentSelection = cultivationOptions.find((c) => c.value === current_b_lu_catalogue)

  return (
    <RemixFormProvider {...form}>
      <fieldset disabled={form.formState.isSubmitting}>
        <Card>
          <CardHeader>
            <CardTitle>Perceel</CardTitle>
          </CardHeader>
          <CardContent>
            <Form id="formField" method="POST" onSubmit={form.handleSubmit}>
              <div className="grid grid-cols-1 items-center gap-4 md:grid-cols-2">
                <Controller
                  name="b_name"
                  render={({ field, fieldState }) => (
                    <Field>
                      <FieldLabel>Naam</FieldLabel>
                      <FieldContent>
                        <Input {...field} type="text" required />
                      </FieldContent>
                      <FieldError errors={[fieldState.error]} />
                    </Field>
                  )}
                />
                <Controller
                  name="b_area"
                  disabled={true}
                  render={({ field, fieldState }) => (
                    <Field>
                      <FieldLabel>Oppervlak (ha)</FieldLabel>
                      <FieldContent>
                        <Input {...field} value={(field.value as string) ?? ""} type="text" />
                      </FieldContent>
                      <FieldError errors={[fieldState.error]} />
                    </Field>
                  )}
                />
                <Controller
                  name="b_lu_catalogue"
                  render={({ field, fieldState }) => (
                    <Field className="col-span-2" data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor={field.name}>Hoofdgewas</FieldLabel>
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
                      {currentSelection && currentSelection.availableThisYear === false && (
                        <Alert className="border-amber-200 bg-amber-50 text-amber-700">
                          <AlertTriangle className="size-4 stroke-amber-700" />
                          <p>
                            Deze gewascode is niet beschikbaar voor{" "}
                            {cultivationAvailabilityYear ?? "het huidig geselecteerde jaar"}.
                          </p>
                        </Alert>
                      )}
                      <FieldError errors={[fieldState.error]} />
                    </Field>
                  )}
                />
                <Controller
                  control={form.control}
                  name="b_bufferstrip"
                  render={({ field }) => (
                    <Field className="col-span-full flex flex-row items-center gap-4 rounded-lg border p-4 shadow-sm">
                      <div className="h-auto shrink in-[.w-full]:w-auto">
                        <Checkbox
                          id={field.name}
                          name={field.name}
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </div>
                      <div className="grow space-y-0.5 in-[.w-full]:w-auto">
                        <FieldLabel className="cursor-pointer text-base" htmlFor={field.name}>
                          Bufferstrook
                        </FieldLabel>
                        <FieldDescription className="text-muted-foreground text-sm wrap-break-word">
                          Is dit perceel een bufferstrook?{" "}
                        </FieldDescription>
                      </div>
                    </Field>
                  )}
                />
              </div>
            </Form>
          </CardContent>
          <CardFooter>
            <FieldDeleteDialog
              key={b_id}
              fieldName={b_name}
              isSubmitting={form.formState.isSubmitting}
              buttonText="Verwijderen"
            />
            <Button
              type="submit"
              form="formField"
              disabled={form.formState.isSubmitting}
              className="ml-auto"
            >
              {form.formState.isSubmitting && <Spinner />}
              <span>Bijwerken</span>
            </Button>
          </CardFooter>
        </Card>
      </fieldset>
    </RemixFormProvider>
  )
}

type NewFieldsFormProps = {
  b_id: string
  b_name: string
  b_area: number
  b_lu_catalogue: string
  b_bufferstrip: boolean
  cultivationAvailabilityYear: number | undefined
  cultivationOptions: {
    value: string
    label: string
    availableThisYear?: boolean
  }[]
}
