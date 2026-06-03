import type {
    Agent,
    Message as MessageT,
    Ticket as TicketT,
} from "@nmi-agro/fdm-helpdesk"
import { format } from "date-fns"
import { nl } from "date-fns/locale"
import { CircleCheck, CircleDot, CircleHelp, CirclePause, CirclePlay, CircleX, ChevronDown, UserPlus } from "lucide-react"
import { useEffect, useId, useState } from "react"
import { useNavigation, useSubmit } from "react-router"
import { cn } from "@/app/lib/utils"
import {
    AvatarGroup,
    AvatarGroupCount,
} from "~/components/blocks/farms/user-display"
import { Message } from "~/components/blocks/helpdesk/message"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Dialog, DialogTrigger } from "~/components/ui/dialog"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { Spinner } from "~/components/ui/spinner"
import { AssigneeDialogContent } from "./assignee-dialog"
import { MessageComposer } from "./message-composer"
import type { HelpdeskUser } from "./types"

export const TICKET_STATUS = [
    {
        value: "open",
        label: "Ontvangen",
        color: "#3b82f6", // blue-500
        icon: CircleDot,
    },
    {
        value: "in_progress",
        label: "In behandeling",
        color: "#6366f1", // indigo-500
        icon: CirclePlay,
    },
    {
        value: "pending",
        label: "Wordt nagevraagd",
        color: "#f59e0b", // amber-500
        icon: CirclePause,
    },
    {
        value: "waiting_on_customer",
        label: "Wachten op reactie",
        color: "#f97316", // orange-500
        icon: CircleHelp,
    },
    {
        value: "resolved",
        label: "Opgelost",
        color: "#22c55e", // green-500
        icon: CircleCheck,
    },
    {
        value: "closed",
        label: "Gesloten",
        color: "#6b7280", // gray-500
        icon: CircleX,
    },
]

const TICKET_STATUS_DESCRIPTIONS: Record<string, string> = {
    open: "Uw vraag is ontvangen en wacht op behandeling door een medewerker.",
    in_progress: "Een medewerker is bezig met uw vraag.",
    pending: "We zijn aanvullende informatie aan het opvragen.",
    waiting_on_customer:
        "We wachten op een reactie van u. Voeg een bericht toe hieronder.",
    resolved: "Uw vraag is beantwoord. Neem contact op als u nog vragen heeft.",
    closed: "Dit ticket is gesloten.",
}

const PRIORITY_LABELS: Record<string, string> = {
    low: "Laag",
    normal: "Normaal",
    high: "Hoog",
    urgent: "Urgent",
}

const ALLOWED_TICKET_STATUS_TRANSITIONS: Record<string, string[]> = {
    open: [
        "in_progress",
        "pending",
        "waiting_on_customer",
        "resolved",
        "closed",
    ],
    in_progress: ["pending", "waiting_on_customer", "resolved", "closed"],
    pending: ["in_progress", "waiting_on_customer", "resolved", "closed"],
    waiting_on_customer: ["in_progress", "resolved", "closed"],
    resolved: ["closed", "open"], // "open" = reopen
    closed: ["open"], // "open" = reopen
}

export function TicketStatusDot({
    ticket,
    className,
}: {
    ticket: Pick<TicketT, "status" | "closed_at">
    className?: string
}) {
    const statusEntry = TICKET_STATUS.find(
        (item) => item.value === ticket.status,
    )
    const statusColor = statusEntry?.color ?? "#6b7280"
    const statusLabel = statusEntry?.label ?? ticket.status
    const Icon = statusEntry?.icon ?? CircleDot
    return (
        <Icon
            className={cn("size-4 shrink-0", className)}
            style={{ color: statusColor }}
            aria-label={statusLabel}
        />
    )
}

export function Ticket({
    ticket,
    messages,
    agents = [],
    canAddMessages,
    isAgent,
    principal_id,
    principalLookup,
    sender_role,
    todayDate,
    contextFarmName,
}: {
    ticket: TicketT
    messages: MessageT[]
    agents?: Agent[]
    canAddMessages: boolean
    isAgent: boolean
    principal_id: string
    principalLookup: Map<string, HelpdeskUser>
    sender_role: "agent" | "customer"
    todayDate: Date
    contextFarmName?: string | null
}) {
    const navigation = useNavigation()
    const submit = useSubmit()

    const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false)
    const assigneeSelectId = useId()

    const statusEntry = TICKET_STATUS.find(
        (item) => item.value === ticket.status,
    )
    const statusColor = statusEntry?.color ?? "#777777"
    const statusLabel = statusEntry?.label ?? ticket.status
    const StatusIcon = statusEntry?.icon ?? CircleDot
    const allowedStatusTransitions =
        ALLOWED_TICKET_STATUS_TRANSITIONS[ticket.status] ?? []

    const ASSIGNEE_DISPLAY_CUTOFF = 3
    const assigneeNames = ticket.assignees.map(
        (assignee) => assignee.display_name,
    )

    const requesterName =
        ticket.requester_id
            ? (principalLookup.get(ticket.requester_id)?.displayUserName ??
              null)
            : null

    const isViewed = !!ticket.viewed_at

    // Close dialogs when navigation finishes (the user has probably submitted the form in the dialog)
    useEffect(() => {
        if (navigation.state === "idle") {
            setAssignmentDialogOpen(false)
        }
    }, [navigation.state])

    // Mark ticket as viewed if it wasn't viewed yet
    useEffect(() => {
        if (!isViewed) {
            const formData = new FormData()
            formData.append("intent", "mark_ticket_as_viewed")
            submit(formData, { method: "POST" })
        }
    }, [isViewed, submit])

    return (
        <main className="p-6 space-y-6">
            <header className="space-y-2">
                {/* 1. Meta line — muted, middot-separated */}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                    <span className="font-mono">{ticket.ticket_ref}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                        Aangemaakt op{" "}
                        {format(ticket.created, "PP", { locale: nl })}
                    </span>
                    {ticket.updated && (
                        <>
                            <span aria-hidden="true">·</span>
                            <span>
                                Bijgewerkt op{" "}
                                {format(ticket.updated, "PP", { locale: nl })}
                            </span>
                        </>
                    )}
                    {requesterName && (
                        <>
                            <span aria-hidden="true">·</span>
                            <span>door {requesterName}</span>
                        </>
                    )}
                    {contextFarmName && (
                        <>
                            <span aria-hidden="true">·</span>
                            <span>Bedrijf: {contextFarmName}</span>
                        </>
                    )}
                    {isAgent && ticket.priority && (
                        <Badge variant="outline" className="ms-1">
                            Prioriteit:{" "}
                            {PRIORITY_LABELS[ticket.priority] ??
                                ticket.priority}
                        </Badge>
                    )}
                </div>

                {/* 2. Title */}
                <h1 className="text-3xl font-bold">
                    {ticket.subject ?? "Ticket"}
                </h1>

                {/* 3. State row */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    {isAgent ? (
                        <>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="gap-2 font-medium"
                                        disabled={
                                            navigation.state !== "idle" ||
                                            allowedStatusTransitions.length ===
                                                0
                                        }
                                    >
                                        <StatusIcon
                                            className="size-4 shrink-0"
                                            style={{ color: statusColor }}
                                        />
                                        {statusLabel}
                                        {allowedStatusTransitions.length >
                                            0 && (
                                            <ChevronDown className="size-3 opacity-50 ms-1" />
                                        )}
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start">
                                    {TICKET_STATUS.filter((item) =>
                                        allowedStatusTransitions.includes(
                                            item.value,
                                        ),
                                    ).map((item) => (
                                        <DropdownMenuItem
                                            key={item.value}
                                            className="gap-2"
                                            onClick={() => {
                                                const formData = new FormData()
                                                formData.append(
                                                    "intent",
                                                    "set_ticket_status",
                                                )
                                                formData.append(
                                                    "status",
                                                    item.value,
                                                )
                                                submit(formData, {
                                                    method: "post",
                                                })
                                            }}
                                        >
                                            <item.icon
                                                className="size-4 shrink-0"
                                                style={{ color: item.color }}
                                            />
                                            {item.label}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                            <label
                                htmlFor={assigneeSelectId}
                                className="text-muted-foreground"
                            >
                                Medewerker:
                            </label>
                            <Dialog
                                open={assignmentDialogOpen}
                                onOpenChange={setAssignmentDialogOpen}
                            >
                                <DialogTrigger asChild>
                                    <Button
                                        id={assigneeSelectId}
                                        variant="outline"
                                        size="sm"
                                        className="gap-2"
                                        disabled={navigation.state !== "idle"}
                                    >
                                        {ticket.assignees.length > 0 ? (
                                            <AvatarGroup>
                                                {ticket.assignees
                                                    .slice(
                                                        0,
                                                        ASSIGNEE_DISPLAY_CUTOFF,
                                                    )
                                                    .map((assignee) => (
                                                        <Avatar
                                                            key={
                                                                assignee.agent_id
                                                            }
                                                            className="h-5 w-5 rounded-full"
                                                        >
                                                            <AvatarImage
                                                                src={
                                                                    principalLookup.get(
                                                                        assignee.agent_id,
                                                                    )?.image ??
                                                                    undefined
                                                                }
                                                                alt={
                                                                    principalLookup.get(
                                                                        assignee.agent_id,
                                                                    )
                                                                        ?.displayUserName ??
                                                                    "Onbekende Medewerker"
                                                                }
                                                            />
                                                            <AvatarFallback className="text-[10px]">
                                                                {principalLookup.get(
                                                                    assignee.agent_id,
                                                                )?.initials ??
                                                                    "OM"}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                    ))}
                                                {ticket.assignees.length >
                                                ASSIGNEE_DISPLAY_CUTOFF ? (
                                                    <AvatarGroupCount>
                                                        +
                                                        {ticket.assignees
                                                            .length -
                                                            ASSIGNEE_DISPLAY_CUTOFF}
                                                    </AvatarGroupCount>
                                                ) : null}
                                            </AvatarGroup>
                                        ) : (
                                            <UserPlus className="size-4 text-muted-foreground" />
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
                                <AssigneeDialogContent
                                    assignees={ticket.assignees}
                                    agents={agents}
                                    intent="change_assignment"
                                    canModify={isAgent}
                                    principalLookup={principalLookup}
                                />
                            </Dialog>
                        </>
                    ) : (
                        <span className="inline-flex items-center gap-1.5 text-sm font-medium border rounded-md px-2.5 py-1">
                            <StatusIcon
                                className="size-4 shrink-0"
                                style={{ color: statusColor }}
                            />
                            {statusLabel}
                        </span>
                    )}
                    <Spinner
                        className={cn(
                            "ms-auto",
                            navigation.state === "idle" && "invisible",
                        )}
                    />
                </div>

                {/* 4. Customer status description */}
                {!isAgent && TICKET_STATUS_DESCRIPTIONS[ticket.status] && (
                    <p className="text-sm text-muted-foreground">
                        {TICKET_STATUS_DESCRIPTIONS[ticket.status]}
                    </p>
                )}
            </header>
            <div className="space-y-4">
                {messages.map((msg) => (
                    <Message
                        key={msg.message_id}
                        principal={principalLookup.get(msg.sender_id) ?? null}
                        isInternal={msg.is_internal}
                        date={msg.created}
                        todayDate={todayDate}
                    >
                        <p
                            className="whitespace-pre-wrap text-sm"
                            // biome-ignore lint/security/noDangerouslySetInnerHtml: message bodies are sanitized server-side before being written to the database
                            dangerouslySetInnerHTML={{ __html: msg.body }}
                        />
                    </Message>
                ))}
                {canAddMessages && (
                    <MessageComposer
                        intent="add_message"
                        principal={principalLookup.get(principal_id) ?? null}
                        showAgentControls={isAgent}
                        defaultValues={{
                            sender_role: sender_role,
                            is_internal: false,
                            body: "",
                        }}
                    />
                )}
            </div>
        </main>
    )
}
