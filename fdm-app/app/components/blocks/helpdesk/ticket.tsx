import type {
    Message as MessageT,
    Ticket as TicketT,
} from "@nmi-agro/fdm-helpdesk"
import { formatDate } from "date-fns"
import { nl } from "date-fns/locale"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { Message } from "~/components/blocks/helpdesk/message"

export function Ticket({
    ticket,
    messages,
}: {
    ticket: TicketT
    messages: MessageT[]
}) {
    const requesterName = messages.find(
        (msg) => msg.sender_type === "customer",
    )?.sender_name

    return (
        <>
            <FarmTitle
                title={ticket.subject ?? "Ticket"}
                description={`door ${requesterName ?? "onbekende verzender"} op ${formatDate(ticket.created, "PP", { locale: nl })}`}
            />
            {messages.map((msg) => (
                <Message key={msg.message_id} message={msg} />
            ))}
        </>
    )
}
