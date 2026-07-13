import type { Agent } from "@nmi-agro/fdm-helpdesk"
import type z from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useId } from "react"
import { Controller, useWatch, type Resolver } from "react-hook-form"
import { Form, useFetcher } from "react-router"
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
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import { Spinner } from "~/components/ui/spinner"
import { Switch } from "~/components/ui/switch"
import { AGENT_AVAILABILITY_STATUSES } from "./agent-availability"
import { AssignmentTierOptions, UpdateAgentSchema } from "./agent-schema"

type AgentFormDefaults = Partial<Agent> & { agent_id: string }
type AgentFormValues = z.infer<typeof UpdateAgentSchema>

function getFormDefaults(agent: AgentFormDefaults): AgentFormValues {
  const work_days = Array.isArray(agent.work_days)
    ? agent.work_days.map((day) => day).filter((d) => typeof d === "number")
    : [1, 2, 3, 4, 5]

  return {
    ...agent,
    display_name: agent.display_name ?? "",
    availability_status: (["online", "away", "out-of-office"].includes(
      agent.availability_status ?? "",
    )
      ? agent.availability_status
      : "online") as AgentFormValues["availability_status"],
    work_days: work_days,
    reassign_tickets: false,
    assignment_tier: AssignmentTierOptions.some((o) => o.value === agent.assignment_tier)
      ? (agent.assignment_tier as (typeof AssignmentTierOptions)[number]["value"])
      : (1 as (typeof AssignmentTierOptions)[number]["value"]),
  }
}

export function useAgentForm({ agent }: { agent: AgentFormDefaults }) {
  const form = useRemixForm<AgentFormValues>({
    mode: "onTouched",
    resolver: zodResolver(UpdateAgentSchema) as Resolver<AgentFormValues>,
    defaultValues: getFormDefaults(agent),
  })

  const availability_status = useWatch({ control: form.control, name: "availability_status" })

  useEffect(() => {
    form.reset(getFormDefaults(agent))
  }, [form.reset, agent])

  useEffect(() => {
    form.setValue("reassign_tickets", availability_status === "out-of-office")
  }, [availability_status])

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

export function AgentFormFields({ agent, isAdmin }: { agent: Agent; isAdmin: boolean }) {
  const statusOnlineId = useId()
  const statusAwayId = useId()
  const statusOutOfOfficeId = useId()
  const radioIds: Record<(typeof AGENT_AVAILABILITY_STATUSES)[number]["value"], string> = {
    online: statusOnlineId,
    away: statusAwayId,
    "out-of-office": statusOutOfOfficeId,
  }
  const availability_status = useWatch({ name: "availability_status" })

  return (
    <>
      <Controller
        name="display_name"
        render={({ field, fieldState }) => (
          <Field>
            <FieldLabel>Naam</FieldLabel>
            <FieldDescription>De naam die gebruikers kunnen zien.</FieldDescription>
            <Input {...field} placeholder={agent.display_name} />
            {fieldState.error && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      <Controller
        name="assignment_tier"
        render={({ field, fieldState }) => (
          <Field>
            <FieldLabel>Rang</FieldLabel>
            <FieldDescription>
              De rang van de agent tijdens het toewijzen van tickets.
            </FieldDescription>
            <Select
              value={field.value?.toString() ?? "1"}
              onValueChange={(value) => field.onChange(Number.parseInt(value, 10))}
              disabled={!isAdmin}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1e linie - voorkeur voor toewijzing</SelectItem>
                <SelectItem value="2">2e linie</SelectItem>
                <SelectItem value="3">3e linie - escalatie</SelectItem>
              </SelectContent>
            </Select>
            {fieldState.error && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      <Controller
        name="availability_status"
        render={({ field, fieldState }) => (
          <div className="space-y-2">
            <Field>
              <FieldLabel>Status</FieldLabel>
              <FieldDescription>Wat is je beschikbaarheid op dit moment?</FieldDescription>
              <RadioGroup
                value={field.value}
                onValueChange={(newValue) => field.onChange(newValue)}
              >
                {AGENT_AVAILABILITY_STATUSES.map((status) => (
                  <Field orientation="horizontal" key={status.value}>
                    <RadioGroupItem id={radioIds[status.value]} value={status.value} />
                    <FieldLabel htmlFor={radioIds[status.value]}>
                      <span>
                        {status.label}:{" "}
                        <span className="text-muted-foreground">{status.description}</span>
                      </span>
                    </FieldLabel>
                  </Field>
                ))}
              </RadioGroup>
              {fieldState.error && <FieldError errors={[fieldState.error]} />}
            </Field>
          </div>
        )}
      />
      {availability_status === "out-of-office" && (
        <Controller
          name="reassign_tickets"
          render={({ field, fieldState }) => (
            <div>
              <Card className="inline-block p-2">
                <Field orientation="horizontal">
                  <FieldLabel>Mijn tickets opnieuw toewijzen</FieldLabel>
                  <Switch
                    checked={field.value}
                    onCheckedChange={(checked) => field.onChange(checked)}
                  />
                </Field>
                {fieldState.error && <FieldError errors={[fieldState.error]} />}
              </Card>
            </div>
          )}
        />
      )}
      <Controller
        name="work_days"
        render={({ field, fieldState }) => (
          <Field>
            <FieldLabel>Werkdagen</FieldLabel>
            <FieldDescription>
              Dagen in een week dat je beschikbaar bent om tickets te behandelen.
            </FieldDescription>
            <div className="flex flex-col gap-2 md:flex-row">
              {WORK_DAYS.map(([dayName, dayNumber]) => (
                <div key={dayNumber} className="flex flex-row items-center gap-2 md:flex-col">
                  <div className="text-muted-foreground">{dayName}</div>
                  <Checkbox
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
          </Field>
        )}
      />
    </>
  )
}

export function AgentForm({ agent, isAdmin }: { agent: Agent; isAdmin: boolean }) {
  const form = useAgentForm({ agent })

  const isSubmitting = form.formState.isSubmitting

  return (
    <RemixFormProvider {...form}>
      <Form method="post" onSubmit={form.handleSubmit} className="mx-auto max-w-2xl space-y-6">
        <fieldset disabled={isSubmitting} className="space-y-4">
          <AgentFormFields agent={agent} isAdmin={isAdmin} />
        </fieldset>
        <div className="text-end">
          <Button type="submit" disabled={isSubmitting}>
            Opslaan{isSubmitting && <Spinner />}
          </Button>
        </div>
      </Form>
    </RemixFormProvider>
  )
}

export function AgentFormDialog({
  agent,
  isAdmin,
  open,
  onOpenChange,
}: {
  agent: Agent
  isAdmin: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const form = useAgentForm({ agent })
  const fetcher = useFetcher()
  const formId = useId()

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
              <AgentFormFields agent={agent} isAdmin={isAdmin} />
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
