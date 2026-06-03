import type {
    AgentSummary,
    TicketAssignmentSummary,
} from "@nmi-agro/fdm-helpdesk"
import { Check, Crown, Users } from "lucide-react"
import { type MouseEventHandler, useEffect, useId, useState } from "react"
import { Form, useNavigation } from "react-router"
import { cn } from "@/app/lib/utils"
import { UserAvatar } from "~/components/blocks/farms/user-display"
import { Button } from "~/components/ui/button"
import {
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "~/components/ui/dialog"
import { Field } from "~/components/ui/field"
import { Separator } from "~/components/ui/separator"
import { Spinner } from "~/components/ui/spinner"
import { Tooltip, TooltipContent, TooltipTrigger } from "../../ui/tooltip"
import { makeHelpdeskUser } from "./helpdesk-user"
import type { HelpdeskUser } from "./types"

export function AssigneeDialogContent({
    assignees,
    agents,
    intent,
    canModify,
    principalLookup,
}: {
    assignees: TicketAssignmentSummary[]
    agents: AgentSummary[]
    intent?: string
    canModify: boolean
    principalLookup: Map<string, HelpdeskUser>
}) {
    const navigation = useNavigation()
    const formId = useId()
    const alreadyAssigned = new Set(
        assignees.map((assignee) => assignee.agent_id),
    )
    const [selectedAssignees, setSelectedAssignees] = useState<string[]>(
        assignees.map((assignee) => assignee.agent_id),
    )
    const [primaryAssignees, setPrimaryAssignees] = useState<string[]>(
        assignees
            .filter((assignee) => assignee.is_primary)
            .map((assignee) => assignee.agent_id),
    )
    const unassignedAgents = agents.filter(
        (agent) => !alreadyAssigned.has(agent.agent_id),
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
                setPrimaryAssignees((currentPrimary) =>
                    currentPrimary.filter((id) => id !== agentId),
                )
                return currentAssignees.filter((id) => id !== agentId)
            }

            setPrimaryAssignees((currentPrimary) => {
                if (currentPrimary.length > 0) return currentPrimary
                return currentPrimary.concat(agentId)
            })

            return currentAssignees.concat(agentId)
        })
    }

    useEffect(() => {
        setSelectedAssignees(assignees.map((assignee) => assignee.agent_id))
        setPrimaryAssignees(
            assignees
                .filter((assignee) => assignee.is_primary)
                .map((assignee) => assignee.agent_id),
        )
    }, [assignees])

    return (
        <DialogContent className="sm:max-w-md">
            <Form id={formId} method="post" className="space-y-4">
                <DialogHeader>
                    <DialogTitle>Medewerker toewijzen</DialogTitle>
                    <DialogDescription>
                        Selecteer wie aan dit ticket werkt. De medewerker met de
                        kroon is de hoofdverantwoordelijke.
                    </DialogDescription>
                </DialogHeader>

                {typeof intent === "string" && (
                    <input type="hidden" name="intent" value={intent} />
                )}
                <input
                    type="hidden"
                    name="assignees"
                    value={JSON.stringify(selectedAssignees)}
                />
                <input
                    type="hidden"
                    name="primary"
                    value={JSON.stringify(primaryAssignees)}
                />

                <Field className="overflow-auto max-h-80 space-y-1">
                    {agents.length === 0 && assignees.length === 0 && (
                        <div className="flex flex-col items-center gap-2 py-6 text-center text-sm text-muted-foreground">
                            <Users className="size-8 opacity-40" />
                            <p>Geen medewerkers beschikbaar</p>
                        </div>
                    )}

                    {assignees.length > 0 && (
                        <>
                            <p className="px-2 pb-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                Toegewezen
                            </p>
                            {assignees.map((assignee) => (
                                <AssigneeSelectItem
                                    key={assignee.agent_id}
                                    agent={assignee}
                                    isSelected={selectedAssignees.includes(
                                        assignee.agent_id,
                                    )}
                                    isPrimary={primaryAssignees.includes(
                                        assignee.agent_id,
                                    )}
                                    principalLookup={principalLookup}
                                    canModify={canModify}
                                    onClick={() =>
                                        toggleAssigned(assignee.agent_id)
                                    }
                                    onIsPrimaryClick={() =>
                                        togglePrimary(assignee.agent_id)
                                    }
                                />
                            ))}
                        </>
                    )}

                    {assignees.length > 0 && unassignedAgents.length > 0 && (
                        <Separator className="my-2" />
                    )}

                    {unassignedAgents.length > 0 && (
                        <>
                            <p className="px-2 pb-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                Beschikbaar
                            </p>
                            {unassignedAgents.map((agent) => (
                                <AssigneeSelectItem
                                    key={agent.agent_id}
                                    agent={agent}
                                    isSelected={selectedAssignees.includes(
                                        agent.agent_id,
                                    )}
                                    isPrimary={primaryAssignees.includes(
                                        agent.agent_id,
                                    )}
                                    principalLookup={principalLookup}
                                    canModify={canModify}
                                    onClick={() =>
                                        toggleAssigned(agent.agent_id)
                                    }
                                    onIsPrimaryClick={() =>
                                        togglePrimary(agent.agent_id)
                                    }
                                />
                            ))}
                        </>
                    )}
                </Field>

                <DialogFooter className="gap-2">
                    <DialogClose asChild>
                        <Button variant="outline">Annuleren</Button>
                    </DialogClose>
                    {canModify ? (
                        <Button type="submit" form={formId}>
                            Opslaan
                            {navigation.state !== "idle" ? (
                                <Spinner className="ms-2" />
                            ) : null}
                        </Button>
                    ) : (
                        <DialogClose asChild>
                            <Button>Sluiten</Button>
                        </DialogClose>
                    )}
                </DialogFooter>
            </Form>
        </DialogContent>
    )
}

function AssigneeSelectItem({
    agent,
    isPrimary,
    isSelected,
    principalLookup,
    canModify,
    onClick,
    onIsPrimaryClick,
}: {
    agent: AgentSummary
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
                "flex flex-row gap-2 items-center rounded-md px-1 transition-colors",
                isSelected && "bg-muted/60",
            )}
        >
            <Button
                type="button"
                variant="ghost"
                className="group grow flex flex-row gap-2 justify-start items-center hover:bg-transparent"
                value={agent.agent_id}
                disabled={!canModify}
                onClick={onClick}
            >
                {/* Checkbox indicator */}
                <span
                    className={cn(
                        "flex items-center justify-center size-4 rounded border shrink-0 transition-colors",
                        isSelected
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-muted-foreground/40",
                    )}
                >
                    {isSelected && <Check className="size-3" />}
                </span>
                <UserAvatar user={makeHelpdeskUser(agent, principalLookup)} />
                <span className="grow text-start group-hover:underline">
                    {agent.display_name}
                </span>
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
                        >
                            <Crown
                                className={cn(
                                    "size-4 transition-colors",
                                    isPrimary
                                        ? "text-amber-500 fill-amber-500"
                                        : "text-muted-foreground/30",
                                )}
                            />
                        </Button>
                    ) : (
                        <Crown
                            className={cn(
                                "size-4 me-2",
                                isPrimary
                                    ? "text-amber-500 fill-amber-500"
                                    : "text-muted-foreground/20",
                            )}
                        />
                    )}
                </TooltipTrigger>
                <TooltipContent>
                    {isPrimary
                        ? "Hoofdverantwoordelijke"
                        : canModify
                          ? "Hoofdverantwoordelijke maken"
                          : null}
                </TooltipContent>
            </Tooltip>
        </div>
    )
}
