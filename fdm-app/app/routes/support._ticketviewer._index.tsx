import { MessageSquareDashed, Plus } from "lucide-react"
import { NavLink } from "react-router"
import { useCurrentHelpdeskPage } from "~/components/blocks/helpdesk/navigation"
import { Button } from "../components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyTitle } from "../components/ui/empty"

export default function TicketViewerNoSelection() {
  const currentPage = useCurrentHelpdeskPage()
  const isAgentView = currentPage === "inbox" || currentPage === "all_tickets"

  if (isAgentView) {
    return (
      <Empty>
        <MessageSquareDashed className="text-muted-foreground size-8" />
        <EmptyTitle className="text-muted-foreground">
          {currentPage === "inbox" ? "Mijn inbox" : "Alle tickets"}
        </EmptyTitle>
        <EmptyDescription className="text-muted-foreground">
          Selecteer een ticket uit de lijst om het te bekijken of te beantwoorden.
        </EmptyDescription>
      </Empty>
    )
  }

  return (
    <Empty>
      <EmptyContent>
        <EmptyTitle>Mijn tickets</EmptyTitle>
        <EmptyDescription>
          Hier ziet u alle tickets die u heeft aangemaakt. Selecteer een ticket om het gesprek te
          bekijken of te vervolgen.
        </EmptyDescription>
        <Button asChild className="mt-2">
          <NavLink to="/support/new">
            <Plus className="size-4" />
            Nieuw ticket aanmaken
          </NavLink>
        </Button>
      </EmptyContent>
    </Empty>
  )
}
