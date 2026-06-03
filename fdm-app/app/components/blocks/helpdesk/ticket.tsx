import type {
    Agent,
    Message as MessageT,
    Ticket as TicketT,
} from "@nmi-agro/fdm-helpdesk"
import { CircleCheck, CircleDot } from "lucide-react"
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
} from "~/components/ui/select"
import { Spinner } from "~/components/ui/spinner"
import { AssigneeDialogContent } from "./assignee-dialog"
import { MessageComposer } from "./message-composer"
import type { HelpdeskUser } from "./types"

const GREEN = "#00aa00"
const PURPLE = "#aa00aa"
export const TICKET_STATUS = [
    { value: "open", label: "Ontvangen", color: GREEN },
    { value: "in_progress", label: "In behandeling", color: GREEN },
    { value: "pending", label: "Wordt nagevraagd", color: PURPLE },
    {
        value: "waiting_on_customer",
        label: "Wachten op reactie van gebruiker",
        color: GREEN,
    },
    { value: "resolved", label: "Opgelost", color: PURPLE },
    { value: "closed", label: "Gesloten", color: PURPLE },
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
}) {
    const navigation = useNavigation()
    const submit = useSubmit()

    const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false)
    const statusSelectId = useId()
    const assigneeSelectId = useId()

    const isResolved = !!ticket.closed_at
    const statusColor =
        TICKET_STATUS.find((item) => item.value === ticket.status)?.color ??
        "#777777"
    const allowedStatusTransitions =
        ALLOWED_TICKET_STATUS_TRANSITIONS[ticket.status] ?? []

    const ASSIGNEE_DISPLAY_CUTOFF = 3
    const assigneeNames = ticket.assignees.map(
        (assignee) => assignee.display_name,
    )

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
            <div className="space-y-4">
                <h1 className="text-3xl font-bold">
                    <Badge
                        variant="outline"
                        className="px-2"
                        style={{
                            fontSize: "0.8em",
                            color: statusColor,
                            borderColor: statusColor,
                        }}
                    >
                        {isResolved ? (
                            <CircleCheck className="size-[0.8em] me-1" />
                        ) : (
                            <CircleDot className="size-[0.8em] me-1" />
                        )}
                        {ticket.ticket_ref}
                    </Badge>{" "}
                    {ticket.subject ?? "Ticket"}
                </h1>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <label
                        htmlFor={statusSelectId}
                        className="text-muted-foreground"
                    >
                        Status:
                    </label>
                    <Select
                        value={ticket.status}
                        onValueChange={(value) => {
                            const formData = new FormData()
                            formData.append("intent", "set_ticket_status")
                            formData.append("status", value)
                            submit(formData, {
                                method: "post",
                            })
                        }}
                    >
                        <SelectTrigger
                            id={statusSelectId}
                            className="flex-initial max-w-60"
                            disabled={
                                navigation.state !== "idle" ||
                                !isAgent ||
                                allowedStatusTransitions.length === 0
                            }
                        >
                            {
                                TICKET_STATUS.find(
                                    (item) => item.value === ticket.status,
                                )?.label
                            }
                        </SelectTrigger>
                        <SelectContent>
                            {TICKET_STATUS.filter((item) =>
                                allowedStatusTransitions.includes(item.value),
                            ).map((item) => (
                                <SelectItem key={item.value} value={item.value}>
                                    {item.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {!isAgent &&
                        TICKET_STATUS_DESCRIPTIONS[ticket.status] && (
                            <span className="text-sm text-muted-foreground">
                                {TICKET_STATUS_DESCRIPTIONS[ticket.status]}
                            </span>
                        )}
                    {isAgent && (
                        <>
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
                                        variant="ghost"
                                        className="group px-2 -ms-2"
                                        disabled={navigation.state !== "idle"}
                                    >
                                        {ticket.assignees.length > 0 && (
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
                                                            className="h-6 w-6 rounded-lg"
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
                                                            <AvatarFallback>
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
                                        )}
                                        <span className="group-hover:underline">
                                            {assigneeNames.length > 0
                                                ? assigneeNames.length > 3
                                                    ? `${assigneeNames.slice(0, 3).join(", ")} en meer`
                                                    : assigneeNames.join(", ")
                                                : "Nog niemand"}
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
                    )}
                    <Spinner
                        className={cn(
                            "ms-auto",
                            navigation.state === "idle" && "invisible",
                        )}
                    />
                </div>
            </div>
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
