import { useCurrentHelpdeskPage } from "~/components/blocks/helpdesk/navigation"
import {
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbSeparator,
} from "~/components/ui/breadcrumb"

export function HeaderHelpdesk() {
    const currentHelpdeskPage = useCurrentHelpdeskPage()

    return (
        <>
            <BreadcrumbItem>
                <BreadcrumbLink href="/support">Ondersteuning</BreadcrumbLink>
            </BreadcrumbItem>
            {currentHelpdeskPage === "new_ticket" && (
                <>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>Nieuw Ticket</BreadcrumbItem>
                </>
            )}
            {currentHelpdeskPage === "my_tickets" && (
                <>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>Mijn Tickets</BreadcrumbItem>
                </>
            )}
            {currentHelpdeskPage === "all_tickets" && (
                <>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>Alle Tickets</BreadcrumbItem>
                </>
            )}
            {currentHelpdeskPage === "inbox" && (
                <>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>Inbox</BreadcrumbItem>
                </>
            )}
            {currentHelpdeskPage === "saved_replies" && (
                <>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>Instellingen</BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>Opgeslagen Reacties</BreadcrumbItem>
                </>
            )}
            {currentHelpdeskPage === "agents" && (
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
