import { useMatches, useSearchParams } from "react-router"

export function useCurrentHelpdeskPage() {
    const [searchParams] = useSearchParams()
    const matches = useMatches()

    const isTicketViewer = matches.some(
        (match) => match.id === "routes/support._ticketviewer",
    )
    const isAgents = matches.some(
        (match) => match.id === "routes/support.settings.agents",
    )
    const isNewTicket = matches.some(
        (match) => match.id === "routes/support.new",
    )
    const isSavedReplies = matches.some(
        (match) => match.id === "routes/support.settings.saved-replies",
    )

    return isTicketViewer
        ? searchParams.has("all")
            ? "all_tickets"
            : searchParams.has("inbox")
              ? "inbox"
              : "my_tickets"
        : isAgents
          ? "agents"
          : isNewTicket
            ? "new_ticket"
            : isSavedReplies
              ? "saved_replies"
              : null
}
