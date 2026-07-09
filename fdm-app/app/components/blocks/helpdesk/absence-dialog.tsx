import type { AgentSummary } from "@nmi-agro/fdm-helpdesk"
import { zodResolver } from "@hookform/resolvers/zod"
import { format } from "date-fns"
import { useEffect, useId, useState } from "react"
import { Controller } from "react-hook-form"
import { useFetcher } from "react-router"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import { Spinner } from "~/components/ui/spinner"
import { Textarea } from "~/components/ui/textarea"
import type { AbsenceCalendarItem } from "./absence-calendar"
import { getAgentColor } from "./absence-colors"
import { AbsenceReasonOptions, ScheduleAbsenceSchema, UpdateAbsenceSchema } from "./absence-schema"

const CreateFormSchema = ScheduleAbsenceSchema.extend({ intent: z.literal("create_absence") })
const UpdateFormSchema = UpdateAbsenceSchema.extend({ intent: z.literal("update_absence") })

// yyyy-MM-dd, the format expected by <input type="date">
function toDateInputValue(date: Date | undefined): string {
  return date ? format(date, "yyyy-MM-dd") : ""
}

export interface AbsenceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The absence being viewed/edited, or undefined when creating a new one. */
  absence?: AbsenceCalendarItem
  /** Pre-filled start/end when creating a new absence (e.g. from a calendar drag-select). */
  defaultRange?: { start: Date; end: Date }
  principal_id: string
  isAdmin: boolean
  agents: AgentSummary[]
}

export function AbsenceDialog({
  open,
  onOpenChange,
  absence,
  defaultRange,
  principal_id,
  isAdmin,
  agents,
}: AbsenceDialogProps) {
  const fetcher = useFetcher()
  const formId = useId()
  const isSubmitting = fetcher.state !== "idle"
  const isCreating = !absence
  const [isDeleting, setIsDeleting] = useState(false)

  // Can the current viewer edit (or delete) this absence?
  const canEdit = isCreating || isAdmin || absence?.agent_id === principal_id

  const form = useRemixForm({
    mode: "onSubmit",
    resolver: zodResolver(isCreating ? CreateFormSchema : UpdateFormSchema),
    defaultValues: isCreating
      ? {
          intent: "create_absence" as const,
          agent_id: principal_id,
          start_date: toDateInputValue(defaultRange?.start),
          end_date: toDateInputValue(defaultRange?.end),
          reason: "holiday" as const,
          note: "",
        }
      : {
          intent: "update_absence" as const,
          absence_id: absence?.absence_id ?? "",
          start_date: toDateInputValue(absence?.start_date),
          end_date: toDateInputValue(absence?.end_date),
          reason: (absence?.reason ?? "holiday") as "holiday" | "day_off" | "sick" | "other",
          note: absence?.note ?? "",
        },
  })

  // Reset the form whenever the dialog is (re)opened for a different absence/range.
  // biome-ignore-start lint/correctness/useExhaustiveDependencies: intentionally only depends on identity of open target
  useEffect(() => {
    if (!open) return
    if (isCreating) {
      form.reset({
        intent: "create_absence",
        agent_id: principal_id,
        start_date: toDateInputValue(defaultRange?.start),
        end_date: toDateInputValue(defaultRange?.end),
        reason: "holiday",
        note: "",
      })
    } else if (absence) {
      form.reset({
        intent: "update_absence",
        absence_id: absence.absence_id,
        start_date: toDateInputValue(absence.start_date),
        end_date: toDateInputValue(absence.end_date),
        reason: absence.reason as "holiday" | "day_off" | "sick" | "other",
        note: absence.note ?? "",
      })
    }
    // biome-ignore-end lint/correctness/useExhaustiveDependencies
  }, [open, absence?.absence_id, defaultRange?.start, defaultRange?.end])

  // Close the dialog once the submission succeeds.
  useEffect(() => {
    if (form.formState.isSubmitSuccessful) {
      onOpenChange(false)
    }
  }, [form.formState.isSubmitSuccessful, onOpenChange])

  // Close the dialog once a delete request succeeds.
  useEffect(() => {
    if (isDeleting && fetcher.state === "idle") {
      setIsDeleting(false)
      onOpenChange(false)
    }
  }, [isDeleting, fetcher.state, onOpenChange])

  function handleDelete() {
    if (!absence) return
    setIsDeleting(true)
    const formData = new FormData()
    formData.append("intent", "delete_absence")
    formData.append("absence_id", absence.absence_id)
    void fetcher.submit(formData, { method: "post" })
  }

  const colors = absence ? getAgentColor(absence.agent_id, true) : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <RemixFormProvider {...form}>
          <fetcher.Form
            id={formId}
            method="post"
            onSubmit={form.handleSubmit}
            className="space-y-4"
          >
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {colors && (
                  <span
                    className="size-3 shrink-0 rounded-full"
                    style={{ backgroundColor: colors.border }}
                  />
                )}
                {isCreating ? "Afwezigheid inplannen" : "Afwezigheid"}
              </DialogTitle>
              <DialogDescription>
                {isCreating
                  ? "Plan een nieuwe periode van afwezigheid in."
                  : canEdit
                    ? "Bekijk of wijzig de details van deze afwezigheid."
                    : "Bekijk de details van deze afwezigheid."}
              </DialogDescription>
            </DialogHeader>

            <input
              type="hidden"
              name="intent"
              value={isCreating ? "create_absence" : "update_absence"}
            />
            {!isCreating && <input type="hidden" name="absence_id" value={absence?.absence_id} />}

            {isCreating && isAdmin && (
              <Controller
                name="agent_id"
                render={({ field, fieldState }) => (
                  <Field>
                    <FieldLabel>Medewerker</FieldLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isSubmitting}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Kies een medewerker" />
                      </SelectTrigger>
                      <SelectContent>
                        {agents.map((agent) => (
                          <SelectItem key={agent.agent_id} value={agent.agent_id}>
                            {agent.display_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
            )}
            {isCreating && !isAdmin && <input type="hidden" name="agent_id" value={principal_id} />}
            {!isCreating && (
              <Field>
                <FieldLabel>Medewerker</FieldLabel>
                <p className="text-sm">{absence?.display_name}</p>
              </Field>
            )}

            <div className="grid grid-cols-2 gap-4">
              <Controller
                name="start_date"
                render={({ field, fieldState }) => (
                  <Field>
                    <FieldLabel>Startdatum</FieldLabel>
                    <Input
                      type="date"
                      {...field}
                      value={field.value ?? ""}
                      disabled={!canEdit || isSubmitting}
                    />
                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              <Controller
                name="end_date"
                render={({ field, fieldState }) => (
                  <Field>
                    <FieldLabel>Einddatum</FieldLabel>
                    <Input
                      type="date"
                      {...field}
                      value={field.value ?? ""}
                      disabled={!canEdit || isSubmitting}
                    />
                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
            </div>

            <Controller
              name="reason"
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel>Reden</FieldLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={!canEdit || isSubmitting}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Kies een reden" />
                    </SelectTrigger>
                    <SelectContent>
                      {AbsenceReasonOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldState.error && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />

            <Controller
              name="note"
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel>Notitie</FieldLabel>
                  <Textarea
                    placeholder="Optionele toelichting"
                    {...field}
                    value={field.value ?? ""}
                    disabled={!canEdit || isSubmitting}
                  />
                  {fieldState.error && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />

            <DialogFooter className="gap-2">
              {!isCreating && canEdit && (
                <Button
                  type="button"
                  variant="destructive"
                  className="sm:mr-auto"
                  disabled={isSubmitting}
                  onClick={handleDelete}
                >
                  Verwijderen
                </Button>
              )}
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  {canEdit ? "Annuleren" : "Sluiten"}
                </Button>
              </DialogClose>
              {canEdit && (
                <Button type="submit" form={formId} disabled={isSubmitting}>
                  Opslaan
                  {isSubmitting ? <Spinner className="ms-2" /> : null}
                </Button>
              )}
            </DialogFooter>
          </fetcher.Form>
        </RemixFormProvider>
      </DialogContent>
    </Dialog>
  )
}
