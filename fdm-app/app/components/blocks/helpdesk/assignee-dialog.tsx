import type {
    AgentSummary,
    TicketAssignmentSummary,
} from "@nmi-agro/fdm-helpdesk"
import { Check, Crown } from "lucide-react"
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
import { Spinner } from "~/components/ui/spinner"
import { Tooltip, TooltipContent, TooltipTrigger } from "../../ui/tooltip"
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
        <DialogContent>
            <Form id={formId} method="post" className="space-y-4">
                <DialogHeader>
                    <DialogTitle>Ticket toewijzen</DialogTitle>
                    <DialogDescription>
                        Hier kun je zien en beheren de medewerkers die zijn
                        toegewezen of niet.
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

                <Field className="overflow-auto">
                    {agents.length === 0 && assignees.length === 0 && (
                        <p className="text-center text-sm text-muted-foreground">
                            Nog niemand
                        </p>
                    )}
                    {agents.length > 0 && assignees.length > 0 && (
                        <h2 className="text-sm text-muted-foreground">
                            Al toegewezen
                        </h2>
                    )}

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
                            onClick={() => toggleAssigned(assignee.agent_id)}
                            onIsPrimaryClick={() =>
                                togglePrimary(assignee.agent_id)
                            }
                        />
                    ))}

                    {unassignedAgents.length > 0 && (
                        <h2 className="text-sm text-muted-foreground">
                            Nog niet toegewezen
                        </h2>
                    )}

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
                            onClick={() => toggleAssigned(agent.agent_id)}
                            onIsPrimaryClick={() =>
                                togglePrimary(agent.agent_id)
                            }
                        />
                    ))}
                </Field>

                <DialogFooter>
                    {canModify ? (
                        <Button type="submit" form={formId}>
                            Opslaan{" "}
                            {navigation.state !== "idle" ? <Spinner /> : null}
                        </Button>
                    ) : (
                        <DialogClose asChild>
                            <Button variant="outline">Sluiten</Button>
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
    const assigneePrincipal = principalLookup.get(agent.agent_id)
    const assigneeInitials = agent.display_name
        .split(" ")
        .filter((x) => x.length > 0)
        .map((x) => x[0].toUpperCase())
        .join("")
    return (
        <p className="flex flex-row gap-2 items-center">
            <Button
                type="button"
                variant="ghost"
                className="group grow flex flex-row gap-2 justify-start items-center hover:bg-transparent"
                value={agent.agent_id}
                disabled={!canModify}
                onClick={onClick}
            >
                <Check
                    className={cn(
                        "text-muted-foreground",
                        !isSelected && "invisible",
                    )}
                />
                <UserAvatar
                    user={{
                        displayUserName: agent.display_name,
                        initials: assigneeInitials,
                        image: assigneePrincipal?.image ?? null,
                    }}
                />
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
                            onClick={onIsPrimaryClick}
                        >
                            <Crown
                                className={cn(
                                    "text-muted-foreground hover:text-muted-foreground",
                                    !isPrimary && "text-muted-foreground/25",
                                )}
                            />
                        </Button>
                    ) : (
                        <Crown
                            className={cn(
                                "text-muted-foreground hover:text-muted-foreground",
                                !isPrimary && "text-muted-foreground/25",
                            )}
                        />
                    )}
                </TooltipTrigger>
                <TooltipContent>
                    {isPrimary
                        ? "Dit is de hoofdtoegewezen."
                        : canModify
                          ? "Hoofdtoegewezen maken"
                          : null}
                </TooltipContent>
            </Tooltip>
        </p>
    )
}
