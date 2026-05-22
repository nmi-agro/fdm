import type {
    Agent,
    Message as MessageT,
    Ticket as TicketT,
} from "@nmi-agro/fdm-helpdesk"
import { CircleCheck, CircleDot } from "lucide-react"
import { Message } from "~/components/blocks/helpdesk/message"
import { Badge } from "~/components/ui/badge"
import { Button } from "../../ui/button"
import { Dialog, DialogTrigger } from "../../ui/dialog"
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
}: {
    ticket: TicketT
    messages: MessageT[]
    agents?: Agent[]
    canAddMessages: boolean
    canAddAssignees: boolean
    principal_id: string
    principalLookup: Map<string, HelpdeskUser>
}) {
    const isResolved = !!ticket.closed_at
    const assigneeNames = ticket.assignees.map(
        (assignee) => assignee.display_name,
    )

    return (
        <main className="p-6 space-y-6">
            <div className="space-y-4">
                <h1 className="text-3xl font-bold">
                    <Badge
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
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button variant="link">
                                Toegewezen aan{" "}
                                {assigneeNames.length > 1
                                    ? assigneeNames.length > 3
                                        ? `${assigneeNames.slice(0, 3).join(", ")} en meer`
                                        : assigneeNames.join(", ")
                                    : "nog niemand"}
                            </Button>
                        </DialogTrigger>
                        <AssigneeDialogContent
                            assignees={ticket.assignees}
                            agents={agents}
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
                        principal={
                            principal_id
                                ? (principalLookup.get(principal_id) ?? null)
                                : null
                        }
                        className="mt-10"
                    >
                        <MessageComposer intent="add_message" />
                    </Message>
                )}
            </div>
        </main>
    )
}
