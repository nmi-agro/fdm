import { zodResolver } from "@hookform/resolvers/zod"
import { AgentAbsence } from "@nmi-agro/fdm-helpdesk"
import { Pencil, User, Users } from "lucide-react"
import { useId, useMemo, type ComponentProps } from "react"
import { Controller } from "react-hook-form"
import { NavLink, useFetcher } from "react-router"
import { useRemixForm, RemixFormProvider } from "remix-hook-form"
import z from "zod"
import { cn } from "@/app/lib/utils"
import { useAgentManagerFilterStore } from "@/app/store/agent-manager-filter"
import { AutoComplete } from "~/components/custom/autocomplete"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader } from "~/components/ui/card"
import { Field, FieldContent, FieldLabel } from "~/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import { Spinner } from "~/components/ui/spinner"
import { Switch } from "~/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table"
import type { HelpdeskUser } from "./types"
import { AgentAvailabilityDisplay } from "./agent-availability"
import { AddAgentSchema } from "./agent-schema"
import { HelpdeskUserAvatar } from "./helpdesk-user"
import { SubmitButtonWithReassignmentConfirmation } from "./reassignment-confirmation"

export type HelpdeskUserExtended = HelpdeskUser & {
  absence: AgentAbsence | null
  assignment_tier: number
  role: string
  isInvitation: boolean
  isActive: boolean
}

export const agentRoles = [
  { name: "agent", label: "Medewerker" },
  { name: "admin", label: "Beheerder" },
] as const

type RoleDescription = (typeof agentRoles)[number]
export interface HelpdeskAgentManagerProps {
  helpdeskUsers: HelpdeskUserExtended[]
  roles: readonly RoleDescription[]
  canModify: boolean
}

export function HelpdeskAgentManager({
  helpdeskUsers,
  roles,
  canModify,
}: HelpdeskAgentManagerProps) {
  const onlyActiveId = useId()
  const agentManagerFilter = useAgentManagerFilterStore()

  const filteredHelpdeskUsers = useMemo(
    () =>
      agentManagerFilter.activeOnly ? helpdeskUsers.filter((user) => user.isActive) : helpdeskUsers,
    [helpdeskUsers, agentManagerFilter.activeOnly],
  )

  return (
    <Card className="mx-auto max-w-5xl">
      {canModify && (
        <CardHeader>
          <AddAgentForm helpdeskUsers={helpdeskUsers} roles={roles} />
        </CardHeader>
      )}
      <CardContent className="space-y-4 first:pt-6">
        <Field orientation="horizontal">
          <Switch
            id={onlyActiveId}
            checked={agentManagerFilter.activeOnly}
            onCheckedChange={(value) => agentManagerFilter.setActiveOnly(value)}
          />
          <FieldLabel htmlFor={onlyActiveId}>Toon alleen beschikbare mederwerkers</FieldLabel>
        </Field>
        <Table className="w-full">
          <TableHeader>
            <TableRow>
              <TableHead className="w-0" aria-hidden="true" />
              <TableHead>Medewerker</TableHead>
              {canModify && <TableHead aria-hidden="true" />}
              <TableHead>Linie</TableHead>
              {canModify ? (
                <>
                  <TableHead aria-hidden="true" />
                  <TableHead>Rol</TableHead>
                  <TableHead className="text-end">Acties</TableHead>
                </>
              ) : (
                <TableHead>Rol</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredHelpdeskUsers.map((principal) => (
              <PrincipalRow
                key={principal.principal_id}
                principal={principal}
                roles={roles}
                canModify={canModify}
              />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export interface AddAgentFormProps {
  helpdeskUsers: HelpdeskUser[]
  roles: readonly RoleDescription[]
}

const FormSchema = AddAgentSchema.extend({ intent: z.literal("add_agent") })
export function AddAgentForm({ helpdeskUsers, roles }: AddAgentFormProps) {
  const fetcher = useFetcher()
  const isSubmitting = fetcher.state !== "idle"

  const defaultRole = roles[0].name
  const form = useRemixForm<z.infer<typeof FormSchema>>({
    mode: "onSubmit",
    resolver: zodResolver(FormSchema),
    fetcher: fetcher,
    defaultValues: {
      intent: "add_agent",
      role: defaultRole,
    },
  })

  // Define icon map for AutoComplete
  const iconMap = { user: User, organization: Users }

  return (
    <RemixFormProvider {...form}>
      <fetcher.Form method="post" onSubmit={form.handleSubmit}>
        <fieldset disabled={isSubmitting} className="flex items-center justify-between space-x-4">
          {/* For uncontrolled form - intent is injected in Javascript in submitHandlers, see above. */}
          <input type="hidden" name="intent" value="add_agent" />
          <Controller
            name="principal_id"
            render={({ field }) => (
              <Field className="grow">
                <FieldContent>
                  <AutoComplete
                    lookupUrl="/api/lookup/principal?principal_id"
                    excludeValues={helpdeskUsers.map((p) => p.principal_id)}
                    iconMap={iconMap}
                    selectedValue={field.value}
                    onSelectedValueChange={(value) => form.setValue("principal_id", value)}
                    emptyMessage="Geen gebruikers gevonden."
                    placeholder="Zoek naar een gebruiker of organisatie"
                    allowValuesOutsideList={false}
                    disabled={isSubmitting}
                    form={form} // Pass the form instance
                    name={field.name} // Name for remix-hook-form registration
                  />
                </FieldContent>
              </Field>
            )}
          />
          <Controller
            name="role"
            render={() => (
              <Field className="max-w-50">
                <FieldContent>
                  <RoleSelect
                    defaultValue={defaultRole}
                    onValueChange={(value) =>
                      form.setValue("role", value as RoleDescription["name"])
                    }
                    roles={roles}
                  />
                </FieldContent>
              </Field>
            )}
          />
          <Button type="submit" disabled={isSubmitting}>
            Toevoegen{isSubmitting && <Spinner />}
          </Button>
        </fieldset>
      </fetcher.Form>
    </RemixFormProvider>
  )
}

export interface PrincipalRowProps {
  principal: HelpdeskUserExtended
  roles: readonly RoleDescription[]
  canModify: boolean
}

export function PrincipalRow({ principal, roles, canModify }: PrincipalRowProps) {
  const fetcher = useFetcher()
  const isSubmitting = fetcher.state !== "idle"

  return (
    <TableRow>
      <TableCell className="align-middle">
        <HelpdeskUserAvatar user={principal} type="agent" />
      </TableCell>
      <TableCell width="99%" className="align-middle">
        {principal.displayUserName}
        <AgentAvailabilityDisplay absence={principal.absence} />
      </TableCell>
      {canModify && (
        <TableCell>
          <Spinner className={cn(fetcher.state === "idle" && "invisible")} />
        </TableCell>
      )}
      <TableCell className="text-muted-foreground whitespace-nowrap">{`${principal.assignment_tier}e lijns`}</TableCell>
      {canModify ? (
        <>
          <TableCell>
            <Button variant="ghost" className="text-muted-foreground hover:text-foreground" asChild>
              <NavLink
                to={`/support/settings/agents/${principal.principal_id}`}
                aria-label={`Bewerk medewerker ${principal.displayUserName}`}
              >
                <Pencil />
              </NavLink>
            </Button>
          </TableCell>
          <TableCell className="align-middle">
            {principal.isActive ? (
              <RoleSelect
                roles={roles}
                value={principal.role}
                onValueChange={(value) => {
                  const formData = new FormData()
                  formData.append("intent", "update_agent_role")
                  formData.append("principal_id", principal.principal_id)
                  formData.append("role", value)
                  void fetcher.submit(formData, { method: "post" })
                }}
                disabled={isSubmitting}
              />
            ) : (
              <i className="text-muted-foreground italic">niet actief</i>
            )}
          </TableCell>
          <TableCell className="text-end align-middle">
            <SubmitButtonWithReassignmentConfirmation
              type="button"
              variant={principal.isActive ? "destructive" : "outline"}
              disabled={isSubmitting}
              needsConfirmation={principal.isActive}
              person="third"
              onConfirmation={() => {
                const formData = new FormData()
                formData.append("intent", "set_agent_active_status")
                formData.append("principal_id", principal.principal_id)
                formData.append("is_active", principal.isActive ? "false" : "true")
                void fetcher.submit(formData, { method: "post" })
              }}
            >
              {principal.isActive ? "Deactiveren" : "Activeren"}
            </SubmitButtonWithReassignmentConfirmation>
          </TableCell>
        </>
      ) : (
        <>
          <TableCell>
            {roles.find((role) => role.name === principal.role)?.label ?? "Gebruiker"}
          </TableCell>
        </>
      )}
    </TableRow>
  )
}

function RoleSelect(
  props: ComponentProps<typeof Select> & {
    roles: readonly RoleDescription[]
  },
) {
  const { roles, ...selectProps } = props
  return (
    <Select {...selectProps}>
      <SelectTrigger className="min-w-50">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {roles.map((item) => (
          <SelectItem key={item.name} value={item.name}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
