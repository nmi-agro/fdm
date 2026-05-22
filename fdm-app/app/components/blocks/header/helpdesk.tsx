import { useMatches } from "react-router"
import {
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbSeparator,
} from "~/components/ui/breadcrumb"

export function HeaderHelpdesk() {
    const matches = useMatches()

    const isNewTicket = matches.some(
        (match) => match.id === "routes/support.new",
    )
    const isMyTickets = matches.some(
        (match) => match.id === "routes/support._ticketviewer",
    )
    const isAdminInbox = matches.some(
        (match) => match.id === "routes/admin.support._index",
    )
    const isAdminSavedReplies = matches.some(
        (match) => match.id === "routes/admin.support.saved-replies",
    )
    const isAdminColleagues = matches.some(
        (match) => match.id === "routes/admin.support.settings.colleagues",
    )

    return (
        <>
            <BreadcrumbItem>
                <BreadcrumbLink href="/support">Ondersteuning</BreadcrumbLink>
            </BreadcrumbItem>
            {isNewTicket && (
                <>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>Nieuw Ticket</BreadcrumbItem>
                </>
            )}
            {isMyTickets && (
                <>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>Mijn Tickets</BreadcrumbItem>
                </>
            )}
            {isAdminInbox && (
                <>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>Inbox</BreadcrumbItem>
                </>
            )}
            {isAdminSavedReplies && (
                <>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>Instellingen</BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>Opgeslaande Antwoorden</BreadcrumbItem>
                </>
            )}
            {isAdminColleagues && (
                <>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>Instellingen</BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>Collega</BreadcrumbItem>
                </>
            )}
        </>
    )
}
