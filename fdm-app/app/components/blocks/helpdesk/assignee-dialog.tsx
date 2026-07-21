import type { AgentSummary, AgentAbsence, TicketAssignmentSummary } from "@nmi-agro/fdm-helpdesk"
import { Check, Crown, UserPlus, Users } from "lucide-react"
import { type MouseEventHandler, useEffect, useId, useState } from "react"
import { useFetcher } from "react-router"
import { cn } from "@/app/lib/utils"
import { AvatarGroup, AvatarGroupCount } from "~/components/blocks/farms/user-display"
import { Button } from "~/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog"
import { Field } from "~/components/ui/field"
import { Separator } from "~/components/ui/separator"
import { Spinner } from "~/components/ui/spinner"
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip"
import type { HelpdeskUser } from "./types"
import { AgentAvailabilityDisplay } from "./agent-availability"
import { HelpdeskUserAvatar, makeHelpdeskUser } from "./helpdesk-user"

// How many assignees to display, before saying "en meer/and more"
const ASSIGNEE_DISPLAY_CUTOFF = 3

export function AssignmentSelector({
  triggerId,
  formIntent,
  canModify = true,
  assignees,
  agents,
  agentAbsences,
  principalLookup,
}: {
  triggerId?: string
  formIntent?: string
  canModify?: boolean
  assignees: TicketAssignmentSummary[]
  agents: AgentSummary[]
  agentAbsences?: Map<string, AgentAbsence>
  principalLookup: Map<string, HelpdeskUser>
}) {
  const fetcher = useFetcher()
  const formId = useId()
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false)

  const [selectedAssignees, setSelectedAssignees] = useState<string[]>(
    assignees.map((assignee) => assignee.agent_id),
  )
  const [primaryAssignees, setPrimaryAssignees] = useState<string[]>(
    assignees.filter((assignee) => assignee.is_primary).map((assignee) => assignee.agent_id),
  )

  const assigneeNames = assignees.map((assignee) => assignee.display_name)

  const alreadyAssigned = new Set(assignees.map((assignee) => assignee.agent_id))

  const unassignedAgents = agents.filter((agent) => !alreadyAssigned.has(agent.agent_id))
  // Split unassigned agents by real availability, so "Beschikbaar" only ever lists agents
  // who are actually available. Absent agents get their own group instead of being hidden
  // inside "Beschikbaar", where they could be assigned by mistake during fast triage.
  const availableAgents = unassignedAgents.filter((agent) => !agentAbsences?.get(agent.agent_id))
  const absentAgents = unassignedAgents.filter((agent) => agentAbsences?.get(agent.agent_id))
  const selectedAbsentAgents = absentAgents.filter((agent) =>
    selectedAssignees.includes(agent.agent_id),
  )

  function setSelected(agentId: string, selected: boolean) {
    setSelectedAssignees((current) => {
      const isSelected = current.includes(agentId)
      if (selected === isSelected) return current
      if (selected) return current.concat(agentId)
      return current.filter((id) => id !== agentId)
    })
  }

  function togglePrimary(agentId: string) {
    setPrimaryAssignees((currentPrimary) => {
      const isPrimary = currentPrimary.includes(agentId)
      if (isPrimary) {
        return currentPrimary.filter((id) => id !== agentId)
      }

      setSelected(agentId, true)
      // Clear other primary assignees
      return [agentId]
    })
  }

  function toggleAssigned(agentId: string) {
    setSelectedAssignees((currentAssignees) => {
      const isSelected = currentAssignees.includes(agentId)

      if (isSelected) {
        setPrimaryAssignees((currentPrimary) => currentPrimary.filter((id) => id !== agentId))
        return currentAssignees.filter((id) => id !== agentId)
      }

      setPrimaryAssignees((currentPrimary) => {
        if (currentPrimary.length > 0) return currentPrimary
        return currentPrimary.concat(agentId)
      })

      return currentAssignees.concat(agentId)
    })
  }

  // Close dialogs when navigation finishes (the user has probably submitted the form in the dialog)
  useEffect(() => {
    if (fetcher.state === "idle") {
      setAssignmentDialogOpen(false)
    }
  }, [fetcher.state])

  useEffect(() => {
    setSelectedAssignees(assignees.map((assignee) => assignee.agent_id))
    setPrimaryAssignees(
      assignees.filter((assignee) => assignee.is_primary).map((assignee) => assignee.agent_id),
    )
  }, [assignees])

  return (
    <Dialog open={assignmentDialogOpen} onOpenChange={setAssignmentDialogOpen}>
      <DialogTrigger asChild>
        <Button
          id={triggerId}
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={fetcher.state !== "idle"}
        >
          {assignees.length > 0 ? (
            <AvatarGroup>
              {assignees.slice(0, ASSIGNEE_DISPLAY_CUTOFF).map((assignee) => (
                <HelpdeskUserAvatar
                  key={assignee.agent_id}
                  user={makeHelpdeskUser(assignee, principalLookup)}
                  type="agent"
                />
              ))}
              {assignees.length > ASSIGNEE_DISPLAY_CUTOFF ? (
                <AvatarGroupCount>+{assignees.length - ASSIGNEE_DISPLAY_CUTOFF}</AvatarGroupCount>
              ) : null}
            </AvatarGroup>
          ) : (
            <UserPlus className="text-muted-foreground size-4" />
          )}
          <span>
            {assigneeNames.length > 0
              ? assigneeNames.length > 3
                ? `${assigneeNames.slice(0, 3).join(", ")} en meer`
                : assigneeNames.join(", ")
              : "Toewijzen"}
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <fetcher.Form id={formId} method="post" className="space-y-4">
          <DialogHeader>
            <DialogTitle>Medewerker toewijzen</DialogTitle>
            <DialogDescription>
              Selecteer wie aan dit ticket werkt. De medewerker met de kroon is de
              hoofdverantwoordelijke.
            </DialogDescription>
          </DialogHeader>

          {typeof formIntent === "string" && (
            <input type="hidden" name="intent" value={formIntent} />
          )}
          <input type="hidden" name="assignees" value={JSON.stringify(selectedAssignees)} />
          <input type="hidden" name="primary" value={JSON.stringify(primaryAssignees)} />

          <Field className="max-h-80 space-y-1 overflow-auto">
            {agents.length === 0 && assignees.length === 0 && (
              <div className="text-muted-foreground flex flex-col items-center gap-2 py-6 text-center text-sm">
                <Users className="size-8 opacity-40" />
                <p>Geen medewerkers beschikbaar</p>
              </div>
            )}

            {assignees.length > 0 && (
              <>
                <p className="text-muted-foreground px-2 pb-1 text-xs font-medium tracking-wide uppercase">
                  Toegewezen
                </p>
                {assignees.map((assignee) => (
                  <AssigneeSelectItem
                    key={assignee.agent_id}
                    agent={assignee}
                    agentAbsence={agentAbsences?.get(assignee.agent_id) ?? null}
                    isSelected={selectedAssignees.includes(assignee.agent_id)}
                    isPrimary={primaryAssignees.includes(assignee.agent_id)}
                    principalLookup={principalLookup}
                    canModify={canModify}
                    onClick={() => toggleAssigned(assignee.agent_id)}
                    onIsPrimaryClick={() => togglePrimary(assignee.agent_id)}
                  />
                ))}
              </>
            )}

            {assignees.length > 0 && unassignedAgents.length > 0 && <Separator className="my-2" />}

            {availableAgents.length > 0 && (
              <>
                <p className="text-muted-foreground px-2 pb-1 text-xs font-medium tracking-wide uppercase">
                  Beschikbaar
                </p>
                {availableAgents.map((agent) => (
                  <AssigneeSelectItem
                    key={agent.agent_id}
                    agent={agent}
                    agentAbsence={null}
                    isSelected={selectedAssignees.includes(agent.agent_id)}
                    isPrimary={primaryAssignees.includes(agent.agent_id)}
                    principalLookup={principalLookup}
                    canModify={canModify}
                    onClick={() => toggleAssigned(agent.agent_id)}
                    onIsPrimaryClick={() => togglePrimary(agent.agent_id)}
                  />
                ))}
              </>
            )}

            {availableAgents.length > 0 && absentAgents.length > 0 && (
              <Separator className="my-2" />
            )}

            {absentAgents.length > 0 && (
              <>
                <p className="text-muted-foreground px-2 pb-1 text-xs font-medium tracking-wide uppercase">
                  Afwezig
                </p>
                {absentAgents.map((agent) => (
                  <AssigneeSelectItem
                    key={agent.agent_id}
                    agent={agent}
                    agentAbsence={agentAbsences?.get(agent.agent_id) ?? null}
                    isSelected={selectedAssignees.includes(agent.agent_id)}
                    isPrimary={primaryAssignees.includes(agent.agent_id)}
                    principalLookup={principalLookup}
                    canModify={canModify}
                    onClick={() => toggleAssigned(agent.agent_id)}
                    onIsPrimaryClick={() => togglePrimary(agent.agent_id)}
                  />
                ))}
              </>
            )}
          </Field>

          {selectedAbsentAgents.length > 0 && (
            <p className="border-amber-200 bg-amber-50 text-amber-900 rounded-md border px-3 py-2 text-sm">
              {selectedAbsentAgents.length === 1
                ? `${selectedAbsentAgents[0].display_name} is afwezig. Weet je zeker dat je dit ticket aan deze medewerker wilt toewijzen?`
                : "Een of meer geselecteerde medewerkers zijn afwezig. Weet je zeker dat je dit ticket aan hen wilt toewijzen?"}
            </p>
          )}

          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="outline">Annuleren</Button>
            </DialogClose>
            {canModify ? (
              <Button type="submit" form={formId}>
                Opslaan
                {fetcher.state !== "idle" ? <Spinner className="ms-2" /> : null}
              </Button>
            ) : (
              <DialogClose asChild>
                <Button>Sluiten</Button>
              </DialogClose>
            )}
          </DialogFooter>
        </fetcher.Form>
      </DialogContent>
    </Dialog>
  )
}

function AssigneeSelectItem({
  agent,
  agentAbsence,
  isPrimary,
  isSelected,
  principalLookup,
  canModify,
  onClick,
  onIsPrimaryClick,
}: {
  agent: AgentSummary
  agentAbsence: AgentAbsence | null
  isPrimary: boolean
  isSelected: boolean
  principalLookup: Map<string, HelpdeskUser>
  canModify: boolean
  onClick?: MouseEventHandler<HTMLButtonElement>
  onIsPrimaryClick?: MouseEventHandler<HTMLButtonElement>
}) {
  return (
    <div
      className={cn(
        "flex flex-row items-center gap-2 rounded-md px-1 transition-colors",
        isSelected && "bg-muted/60",
      )}
    >
      <Button
        type="button"
        variant="ghost"
        className="group flex grow flex-row items-center justify-start gap-2 hover:bg-transparent"
        value={agent.agent_id}
        disabled={!canModify}
        onClick={onClick}
      >
        {/* Checkbox indicator */}
        <span
          className={cn(
            "flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
            isSelected
              ? "bg-primary border-primary text-primary-foreground"
              : "border-muted-foreground/40",
          )}
        >
          {isSelected && <Check className="size-3" />}
        </span>
        <HelpdeskUserAvatar user={makeHelpdeskUser(agent, principalLookup)} type="agent" />
        <div className="text-start">
          <span className="grow text-start group-hover:underline">{agent.display_name}</span>
          <AgentAvailabilityDisplay absence={agentAbsence} className="text-[11px]" />
        </div>
      </Button>

      <Tooltip>
        <TooltipTrigger asChild>
          {canModify ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 hover:bg-transparent"
              onClick={onIsPrimaryClick}
              disabled={!isSelected}
              aria-label={
                isPrimary
                  ? `${agent.display_name} is hoofdverantwoordelijke`
                  : `Maak ${agent.display_name} hoofdverantwoordelijke`
              }
            >
              <Crown
                className={cn(
                  "size-4 transition-colors",
                  isPrimary ? "fill-amber-500 text-amber-500" : "text-muted-foreground/30",
                )}
              />
            </Button>
          ) : (
            <Crown
              className={cn(
                "me-2 size-4",
                isPrimary ? "fill-amber-500 text-amber-500" : "text-muted-foreground/20",
              )}
            />
          )}
        </TooltipTrigger>
        <TooltipContent>
          {isPrimary ? "Hoofdverantwoordelijke" : canModify ? "Hoofdverantwoordelijke maken" : null}
        </TooltipContent>
      </Tooltip>
    </div>
  )
}
