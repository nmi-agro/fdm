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

export function CultivationAddFormDialog({ options }: CultivationsFormProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>Gewas toevoegen</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gewas toevoegen</DialogTitle>
        </DialogHeader>
        <CultivationAddForm options={options} onSuccess={() => setIsOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

function CultivationAddForm({
  options,
  onSuccess,
  editable = true,
}: CultivationsFormProps & { editable?: boolean; onSuccess?: () => void }) {
  const form = useRemixForm<z.infer<typeof CultivationAddFormSchema>>({
    mode: "onTouched",
    resolver: zodResolver(CultivationAddFormSchema) as never,
    defaultValues: {
      b_lu_catalogue: "",
      b_lu_start: new Date(),
      b_lu_end: undefined,
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
      <Form id="formCultivation" onSubmit={form.handleSubmit} method="post">
        <fieldset disabled={!editable || form.formState.isSubmitting}>
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
                disabled={false}
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
