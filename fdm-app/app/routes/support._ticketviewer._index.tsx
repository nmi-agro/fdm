import { MessageSquareCheck } from "lucide-react"
import { Empty, EmptyDescription, EmptyTitle } from "../components/ui/empty"

export default function TicketViewerNoSelection() {
    return (
        <Empty>
            <MessageSquareCheck className="size-8 text-muted-foreground" />
            <EmptyTitle className="text-muted-foreground">
                Mijn Tickets
            </EmptyTitle>
            <EmptyDescription className="text-muted-foreground">
                Hier kun je de tickets die je vroeger gemaakt.
            </EmptyDescription>
        </Empty>
    )
}
