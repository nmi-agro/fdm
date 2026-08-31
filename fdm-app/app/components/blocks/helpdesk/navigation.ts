import { useMatches, useSearchParams } from "react-router"

export function useCurrentHelpdeskPage() {
  const [searchParams] = useSearchParams()
  const matches = useMatches()

  if (matches.some((match) => match.id === "routes/support.new")) return "new_ticket"
  if (matches.some((match) => match.id === "routes/support.settings.profile")) return "profile"
  if (matches.some((match) => match.id === "routes/support.settings.agents")) return "agents"
  if (matches.some((match) => match.id === "routes/support.settings.absences")) return "absences"
  if (matches.some((match) => match.id === "routes/support.settings.tags")) return "tags"
  if (matches.some((match) => match.id.startsWith("routes/support.settings.saved-replies")))
    return "saved_replies"
  if (matches.some((match) => match.id === "routes/support.settings.blocked-emails"))
    return "blocked_emails"

  if (matches.some((match) => match.id === "routes/support._ticketviewer")) {
    if (searchParams.has("all")) return "all_tickets"
    if (searchParams.has("inbox")) return "inbox"
    if (searchParams.has("unassigned")) return "unassigned_tickets"
    return "my_tickets"
  }

  return null
}
