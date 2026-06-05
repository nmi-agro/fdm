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
                    <BreadcrumbItem>Nieuw ticket</BreadcrumbItem>
                </>
            )}
            {currentHelpdeskPage === "my_tickets" && (
                <>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>Mijn tickets</BreadcrumbItem>
                </>
            )}
            {currentHelpdeskPage === "unassigned_tickets" && (
                <>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>Tickets</BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>Niet toegewezen</BreadcrumbItem>
                </>
            )}
            {currentHelpdeskPage === "all_tickets" && (
                <>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>Alle tickets</BreadcrumbItem>
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
                    {/* <BreadcrumbSeparator />
                    <BreadcrumbItem>Opgeslagen reacties</BreadcrumbItem> */}
                </>
            )}
            {currentHelpdeskPage === "agents" && (
                <>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>Instellingen</BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>Medewerkers</BreadcrumbItem>
                </>
            )}
        </>
    )
}
