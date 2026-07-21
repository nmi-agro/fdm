import type { Agent } from "@nmi-agro/fdm-helpdesk"
import type z from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useId } from "react"
import { Controller, type Resolver } from "react-hook-form"
import { FetcherWithComponents, useFetcher } from "react-router"
import { RemixFormProvider, useRemixForm } from "remix-hook-form"
import { Button } from "~/components/ui/button"
import { Card } from "~/components/ui/card"
import { Checkbox } from "~/components/ui/checkbox"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldLabel } from "~/components/ui/field"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import { Spinner } from "~/components/ui/spinner"
import { AssignmentTierOptions, UpdateAgentSchema } from "./agent-schema"

type AgentFormDefaults = Partial<Agent> & { agent_id: string }
type AgentFormValues = z.infer<typeof UpdateAgentSchema>
type AgentFormPerson = "second" | "third"

function getFormDefaults(agent: AgentFormDefaults): AgentFormValues {
  const work_days = Array.isArray(agent.work_days)
    ? agent.work_days.filter((d: unknown) => typeof d === "number")
    : [1, 2, 3, 4, 5]

  return {
    ...agent,
    display_name: agent.display_name ?? "",
    work_days: work_days,
    assignment_tier: AssignmentTierOptions.some((o) => o.value === agent.assignment_tier)
      ? (agent.assignment_tier as (typeof AssignmentTierOptions)[number]["value"])
      : (1 as (typeof AssignmentTierOptions)[number]["value"]),
  }
}

export function useAgentForm({
  agent,
  fetcher,
}: {
  agent: AgentFormDefaults
  fetcher: FetcherWithComponents<unknown>
}) {
  const form = useRemixForm<AgentFormValues>({
    mode: "onTouched",
    resolver: zodResolver(UpdateAgentSchema) as Resolver<AgentFormValues>,
    defaultValues: getFormDefaults(agent),
    fetcher: fetcher,
  })

  useEffect(() => {
    form.reset(getFormDefaults(agent))
  }, [form.reset, agent])

  return form
}

const WORK_DAYS: [string, number][] = [
  ["Maandag", 1],
  ["Dinsdag", 2],
  ["Woensdag", 3],
  ["Donderdag", 4],
  ["Vrijdag", 5],
  ["Zaterdag", 6],
  ["Zondag", 0],
]

export function AgentFormFields({
  agent,
  isAdmin,
  person,
}: {
  agent: Agent
  isAdmin: boolean
  person: AgentFormPerson
}) {
  const nameId = useId()
  const assignmentTierId = useId()
  const workDaysIds = [useId(), useId(), useId(), useId(), useId(), useId(), useId()]

  return (
    <>
      <input type="hidden" name="agent_id" value={agent.agent_id} />
      <Controller
        name="display_name"
        render={({ field, fieldState }) => (
          <Field>
            <FieldLabel htmlFor={nameId}>Naam</FieldLabel>
            <FieldDescription>De naam die gebruikers kunnen zien.</FieldDescription>
            <Input {...field} id={nameId} placeholder={agent.display_name} />
            {fieldState.error && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      <Controller
        name="assignment_tier"
        render={({ field, fieldState }) => (
          <Field>
            <FieldLabel htmlFor={assignmentTierId}>Rang</FieldLabel>
            <FieldDescription>
              De rang van de agent tijdens het toewijzen van tickets.
            </FieldDescription>
            <Select
              value={field.value?.toString() ?? "1"}
              onValueChange={(value) => field.onChange(Number.parseInt(value, 10))}
              disabled={!isAdmin}
            >
              <SelectTrigger id={assignmentTierId}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AssignmentTierOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value.toString()}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldState.error && <FieldError errors={[fieldState.error]} />}
            <input {...field} type="hidden" />
          </Field>
        )}
      />
      <Controller
        name="work_days"
        render={({ field, fieldState }) => (
          <Field>
            <FieldLabel>Werkdagen</FieldLabel>
            <FieldDescription>
              {person === "second"
                ? "De dagen in een week dat je beschikbaar bent om tickets te behandelen."
                : "De dagen in een week dat de medewerker beschikbaar is om tickets te behandelen."}
            </FieldDescription>
            <div className="flex flex-col justify-between gap-2 md:flex-row">
              {WORK_DAYS.map(([dayName, dayNumber]) => (
                <div key={dayNumber} className="flex flex-row items-center gap-2 md:flex-col">
                  <Label className="text-muted-foreground" htmlFor={workDaysIds[dayNumber]}>
                    {dayName}
                  </Label>
                  <Checkbox
                    id={workDaysIds[dayNumber]}
                    checked={field.value.includes(dayNumber)}
                    onCheckedChange={(checked) => {
                      const newValue = checked
                        ? [...field.value, dayNumber]
                        : field.value.filter((d: number) => d !== dayNumber)
                      field.onChange(newValue)
                    }}
                  />
                </div>
              ))}
            </div>
            {fieldState.error && <FieldError errors={[fieldState.error]} />}
            <input name={field.name} value={JSON.stringify(field.value)} type="hidden" />
          </Field>
        )}
      />
    </>
  )
}

export function AgentForm({
  agent,
  isAdmin,
  person,
}: {
  agent: Agent
  isAdmin: boolean
  person: AgentFormPerson
}) {
  const fetcher = useFetcher()
  const form = useAgentForm({ agent, fetcher })

  const isSubmitting = form.formState.isSubmitting

  return (
    <Card className="mx-auto max-w-2xl p-6">
      <RemixFormProvider {...form}>
        <fetcher.Form method="post" onSubmit={form.handleSubmit} className="space-y-6">
          <fieldset disabled={isSubmitting} className="space-y-4">
            <AgentFormFields agent={agent} isAdmin={isAdmin} person={person} />
          </fieldset>
          <div className="text-end">
            <Button type="submit" disabled={isSubmitting}>
              Opslaan{isSubmitting && <Spinner />}
            </Button>
          </div>
        </fetcher.Form>
      </RemixFormProvider>
    </Card>
  )
}

export function AgentFormDialog({
  agent,
  isAdmin,
  person,
  open,
  onOpenChange,
}: {
  agent: Agent
  isAdmin: boolean
  person: AgentFormPerson
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const fetcher = useFetcher()
  const formId = useId()
  const form = useAgentForm({ agent, fetcher })

  const isSubmitting = fetcher.state !== "idle"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <RemixFormProvider {...form}>
          <fetcher.Form
            id={formId}
            method="post"
            action={`/support/settings/agents/${agent.agent_id}`}
            onSubmit={form.handleSubmit}
            className="mx-auto space-y-6"
          >
            <input type="hidden" name="agent_id" value={agent.agent_id} />
            <DialogHeader>
              <DialogTitle>Agent Bewerken</DialogTitle>
            </DialogHeader>
            <fieldset disabled={isSubmitting} className="space-y-4">
              <AgentFormFields agent={agent} isAdmin={isAdmin} person={person} />
            </fieldset>
            <DialogFooter className="flex flex-row justify-end gap-2">
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Sluiten
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                Opslaan{isSubmitting && <Spinner />}
              </Button>
            </DialogFooter>
          </fetcher.Form>
        </RemixFormProvider>
      </DialogContent>
    </Dialog>
  )
}
