import { zodResolver } from "@hookform/resolvers/zod"
import type {
    AgentSummary,
    TicketAssignmentSummary,
} from "@nmi-agro/fdm-helpdesk"
import { Check, Crown } from "lucide-react"
import { type MouseEventHandler, useId } from "react"
import {
    Controller,
    type ControllerRenderProps,
    type FieldValues,
    useForm,
} from "react-hook-form"
import { Form, useNavigation } from "react-router"
import { RemixFormProvider } from "remix-hook-form"
import type z from "zod"
import { cn } from "@/app/lib/utils"
import { UserAvatar } from "~/components/blocks/farms/user-display"
import { Button } from "~/components/ui/button"
import {
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "~/components/ui/dialog"
import { Field } from "~/components/ui/field"
import { Spinner } from "~/components/ui/spinner"
import { Tooltip, TooltipContent, TooltipTrigger } from "../../ui/tooltip"
import { AssigneeSchema } from "./assignee-schema"
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
    const alreadyAssigned = new Set(
        assignees.map((assignee) => assignee.agent_id),
    )
    const form = useForm<z.infer<typeof AssigneeSchema>>({
        mode: "onTouched",
        resolver: zodResolver(AssigneeSchema),
        defaultValues: async () => ({
            assignees: JSON.stringify(
                assignees.map((assignee) => assignee.agent_id),
            ),
            primary: JSON.stringify(
                assignees
                    .filter((assignee) => assignee.is_primary)
                    .map((assignee) => assignee.agent_id),
            ),
        }),
    })

    const formId = useId()

    return (
        <RemixFormProvider {...form}>
            <Form id={formId} onSubmit={form.handleSubmit} method="post">
                <DialogContent>
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
                    <Controller
                        name="assignees"
                        render={({
                            field: assigneesField,
                            fieldState: assigneeFieldState,
                        }) => (
                            <Controller
                                name="primary"
                                render={({
                                    field: primaryField,
                                    fieldState: primaryFieldState,
                                }) => {
                                    function set<
                                        T extends "primary" | "assignees",
                                    >(
                                        field: ControllerRenderProps<
                                            FieldValues,
                                            T
                                        >,
                                        agent_id: string,
                                        value: boolean,
                                    ) {
                                        const currentSelection = JSON.parse(
                                            field.value,
                                        ).includes(agent_id)
                                        if (currentSelection !== value) {
                                            toggle(field, agent_id)
                                        }
                                    }
                                    function toggle<
                                        T extends "primary" | "assignees",
                                    >(
                                        field: ControllerRenderProps<
                                            FieldValues,
                                            T
                                        >,
                                        agent_id: string,
                                    ) {
                                        const currentValue = JSON.parse(
                                            field.value,
                                        )
                                        const currentSelection =
                                            currentValue.includes(agent_id)
                                        if (currentSelection) {
                                            form.setValue(
                                                field.name,
                                                JSON.stringify(
                                                    currentValue.filter(
                                                        (id: string) =>
                                                            id !== agent_id,
                                                    ),
                                                ) as any,
                                            )
                                        } else {
                                            form.setValue(
                                                field.name,
                                                JSON.stringify(
                                                    currentValue.concat([
                                                        agent_id,
                                                    ]),
                                                ) as any,
                                            )
                                        }
                                        return !currentSelection
                                    }

                                    const onIsPrimaryClick =
                                        (agent_id: string) => () => {
                                            if (
                                                toggle(primaryField, agent_id)
                                            ) {
                                                set(
                                                    assigneesField,
                                                    agent_id,
                                                    true,
                                                )
                                            }
                                        }
                                    const onClick =
                                        (agent_id: string) => () => {
                                            if (
                                                toggle(assigneesField, agent_id)
                                            ) {
                                                if (
                                                    primaryField.value
                                                        .length === 0
                                                ) {
                                                    set(
                                                        primaryField,
                                                        agent_id,
                                                        true,
                                                    )
                                                }
                                            } else {
                                                set(
                                                    primaryField,
                                                    agent_id,
                                                    false,
                                                )
                                            }
                                        }
                                    return (
                                        <Field className="overflow-auto">
                                            {assignees.length > 0 && (
                                                <h2
                                                    key="already_assigned"
                                                    className="text-sm text-muted-foreground"
                                                >
                                                    Al toegewezen
                                                </h2>
                                            )}
                                            {assignees.map((assignee) => (
                                                <AssigneeSelectItem
                                                    key={assignee.agent_id}
                                                    agent={assignee}
                                                    isSelected={assigneesField.value.includes(
                                                        assignee.agent_id,
                                                    )}
                                                    isPrimary={primaryField.value.includes(
                                                        assignee.agent_id,
                                                    )}
                                                    principalLookup={
                                                        principalLookup
                                                    }
                                                    canModify={canModify}
                                                    onClick={onClick(
                                                        assignee.agent_id,
                                                    )}
                                                    onIsPrimaryClick={onIsPrimaryClick(
                                                        assignee.agent_id,
                                                    )}
                                                />
                                            ))}
                                            {agents.length >
                                                alreadyAssigned.size && (
                                                <h2
                                                    key="already_assigned"
                                                    className="text-sm text-muted-foreground"
                                                >
                                                    Nog niet toegewezen
                                                </h2>
                                            )}
                                            {agents
                                                .filter(
                                                    (a) =>
                                                        !alreadyAssigned.has(
                                                            a.agent_id,
                                                        ),
                                                )
                                                .map((agent) => (
                                                    <AssigneeSelectItem
                                                        key={agent.agent_id}
                                                        agent={agent}
                                                        isSelected={assigneesField.value.includes(
                                                            agent.agent_id,
                                                        )}
                                                        isPrimary={primaryField.value.includes(
                                                            agent.agent_id,
                                                        )}
                                                        principalLookup={
                                                            principalLookup
                                                        }
                                                        canModify={canModify}
                                                        onClick={onClick(
                                                            agent.agent_id,
                                                        )}
                                                        onIsPrimaryClick={onIsPrimaryClick(
                                                            agent.agent_id,
                                                        )}
                                                    />
                                                ))}
                                            {assigneeFieldState.error?.message}
                                            {primaryFieldState.error?.message}
                                        </Field>
                                    )
                                }}
                            />
                        )}
                    />
                    <DialogFooter>
                        <Button type="submit" form={formId}>
                            Opslaan{" "}
                            {navigation.state !== "idle" ? <Spinner /> : null}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Form>
        </RemixFormProvider>
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
                variant="ghost"
                className="group grow flex flex-row gap-2 justify-start items-center hover:bg-transparent"
                value={agent.agent_id}
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
                        <Button variant="ghost" onClick={onIsPrimaryClick}>
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
