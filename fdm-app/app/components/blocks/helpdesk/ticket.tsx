import type {
    Agent,
    Message as MessageT,
    Ticket as TicketT,
} from "@nmi-agro/fdm-helpdesk"
import { CircleCheck, CircleDot } from "lucide-react"
import { useEffect, useState } from "react"
import { useNavigation } from "react-router"
import {
    AvatarGroup,
    AvatarGroupCount,
} from "~/components/blocks/farms/user-display"
import { Message } from "~/components/blocks/helpdesk/message"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Dialog, DialogTrigger } from "~/components/ui/dialog"
import { AssigneeDialogContent } from "./assignee-dialog"
import { MessageComposer } from "./message-composer"
import type { HelpdeskUser } from "./types"

export function Ticket({
    ticket,
    messages,
    agents = [],
    canAddMessages,
    canAddAssignees,
    principal_id,
    principalLookup,
    sender_role,
}: {
    ticket: TicketT
    messages: MessageT[]
    agents?: Agent[]
    canAddMessages: boolean
    canAddAssignees: boolean
    principal_id: string
    principalLookup: Map<string, HelpdeskUser>
    sender_role: "agent" | "customer"
}) {
    const navigation = useNavigation()

    const isResolved = !!ticket.closed_at
    const assigneeNames = ticket.assignees.map(
        (assignee) => assignee.display_name,
    )
    const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false)

    // Close dialogs when navigation finishes (the user has probably submitted the form in the dialog)
    useEffect(() => {
        if (navigation.state === "idle") {
            setAssignmentDialogOpen(false)
        }
    }, [navigation.state])

    const ASSIGNEE_DISPLAY_CUTOFF = 3

    return (
        <main className="p-6 space-y-6">
            <div className="space-y-4">
                <h1 className="text-3xl font-bold">
                    <Badge
                        className="px-2"
                        style={{
                            fontSize: "0.8em",
                            backgroundColor: isResolved ? "#aa00aa" : "#00aa00",
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
                <div className="flex flex-row items-center">
                    <Dialog
                        open={assignmentDialogOpen}
                        onOpenChange={setAssignmentDialogOpen}
                    >
                        <DialogTrigger asChild>
                            <Button
                                variant="ghost"
                                className="group px-2 -ms-2"
                            >
                                {ticket.assignees.length > 0 && (
                                    <AvatarGroup>
                                        {ticket.assignees
                                            .slice(0, ASSIGNEE_DISPLAY_CUTOFF)
                                            .map((assignee) => (
                                                <Avatar
                                                    key={assignee.agent_id}
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
                                                            assignee.display_name
                                                        }
                                                    />
                                                    <AvatarFallback>
                                                        {assignee.display_name
                                                            .split(" ")
                                                            .filter(
                                                                (x) =>
                                                                    x.length >
                                                                    0,
                                                            )
                                                            .slice(0, 2)
                                                            .map((x) =>
                                                                x[0].toUpperCase(),
                                                            )
                                                            .join("")}
                                                    </AvatarFallback>
                                                </Avatar>
                                            ))}
                                        {ticket.assignees.length >
                                        ASSIGNEE_DISPLAY_CUTOFF ? (
                                            <AvatarGroupCount>
                                                +
                                                {ticket.assignees.length -
                                                    ASSIGNEE_DISPLAY_CUTOFF}
                                            </AvatarGroupCount>
                                        ) : null}
                                    </AvatarGroup>
                                )}
                                <span className="group-hover:underline">
                                    Toegewezen aan{" "}
                                    {assigneeNames.length > 0
                                        ? assigneeNames.length > 3
                                            ? `${assigneeNames.slice(0, 3).join(", ")} en meer`
                                            : assigneeNames.join(", ")
                                        : "nog niemand"}
                                </span>
                            </Button>
                        </DialogTrigger>
                        <AssigneeDialogContent
                            assignees={ticket.assignees}
                            agents={agents}
                            intent="change_assignment"
                            canModify={canAddAssignees}
                            principalLookup={principalLookup}
                        />
                    </Dialog>
                </div>
            </div>
            <div className="space-y-4">
                {messages.map((msg) => (
                    <Message
                        key={msg.message_id}
                        principal={principalLookup.get(msg.sender_id) ?? null}
                    >
                        <p>{msg.body}</p>
                    </Message>
                ))}
                {canAddMessages && (
                    <Message
                        title={
                            <>
                                Nieuwe Reactie
                                {agents.some(
                                    (agent) => agent.agent_id === principal_id,
                                ) ? (
                                    <span className="text-muted-foreground/50 italic">
                                        als{" "}
                                        {sender_role === "agent"
                                            ? "medewerker"
                                            : "gebruiker"}
                                    </span>
                                ) : null}
                            </>
                        }
                        principal={
                            principal_id
                                ? (principalLookup.get(principal_id) ?? null)
                                : null
                        }
                        className="mt-10"
                    >
                        <MessageComposer
                            intent="add_message"
                            label="Schrijf beneden"
                        />
                    </Message>
                )}
            </div>
        </main>
    )
}
