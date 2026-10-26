import type { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useRef, useState } from "react"
import { Form } from "react-router"
import { RemixFormProvider, useRemixForm } from "remix-hook-form"
import { Combobox } from "~/components/custom/combobox"
import { DatePicker } from "~/components/custom/date-picker"
import { Button } from "~/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog"
import { Spinner } from "~/components/ui/spinner"
import type { CultivationsFormProps } from "./types"
import { CultivationAddFormSchema } from "./schema"

export function CultivationAddFormDialog({
  options,
  defaultValues,
  onClose,
}: CultivationsFormProps & { onClose?: () => void }) {
  const [isOpen, setIsOpen] = useState(!!defaultValues)
  const isSuggested = !!defaultValues

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (!open) {
      onClose?.()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>Gewas toevoegen</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isSuggested ? "Voorgesteld gewas bevestigen" : "Gewas toevoegen"}
          </DialogTitle>
        </DialogHeader>
        <CultivationAddForm
          options={options}
          defaultValues={defaultValues}
          onSuccess={() => handleOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

export function CultivationAddForm({
  options,
  defaultValues,
  onSuccess,
  editable = true,
  action,
  intent,
  b_id,
  b_lu,
}: CultivationsFormProps & { editable?: boolean; onSuccess?: () => void; action?: string }) {
  const isSuggested = !!defaultValues
  // Computed once, not on every render: used only as the default when there's no start date yet.
  const [today] = useState(() => new Date())
  const form = useRemixForm<z.infer<typeof CultivationAddFormSchema>>({
    mode: "onTouched",
    resolver: zodResolver(CultivationAddFormSchema) as never,
    defaultValues: {
      intent: intent,
      b_id: b_id,
      b_lu: b_lu,
      b_lu_catalogue: defaultValues?.b_lu_catalogue ?? "",
      b_lu_start: defaultValues?.b_lu_start ?? today,
      b_lu_end: defaultValues?.b_lu_end ?? undefined,
    },
  })

  const { isSubmitting, isSubmitSuccessful } = form.formState
  const isSubmittingRef = useRef(isSubmitting)

  useEffect(() => {
    const wasSubmitting = isSubmittingRef.current
    isSubmittingRef.current = isSubmitting
    if (wasSubmitting && !isSubmitting && isSubmitSuccessful) {
      onSuccess?.()
    }
  }, [isSubmitting, isSubmitSuccessful, onSuccess])

  return (
    <RemixFormProvider {...form}>
      <Form id="formCultivation" onSubmit={form.handleSubmit} method="post" action={action}>
        <fieldset disabled={!editable || form.formState.isSubmitting}>
          {typeof intent === "string" && <input type="hidden" name="intent" value={intent} />}
          {typeof b_id === "string" && <input type="hidden" name="b_id" value={b_id} />}
          <div className="grid gap-4">
            <div className="col-span-1">
              <Combobox
                options={options}
                form={form}
                name="b_lu_catalogue"
                label={
                  <span>
                    Gewas
                    <span className="text-red-500">*</span>
                  </span>
                }
                disabled={!!b_lu}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <DatePicker
                form={form as any}
                name={"b_lu_start"}
                label={"Zaaidatum"}
                description={""}
                disabled={form.formState.isSubmitting}
              />
              <DatePicker
                form={form as any}
                name={"b_lu_end"}
                label={"Einddatum"}
                description={"Datum waarop het gewas wordt beëindigd"}
                disabled={form.formState.isSubmitting}
              />
            </div>
            <div className="">
              <Button type="submit" className="w-full">
                {form.formState.isSubmitting ? (
                  <div className="flex items-center space-x-2">
                    <Spinner />
                    <span>Opslaan...</span>
                  </div>
                ) : isSuggested ? (
                  "Bevestigen"
                ) : (
                  "Voeg toe"
                )}
              </Button>
            </div>
          </div>
        </fieldset>
      </Form>
    </RemixFormProvider>
  )
}
