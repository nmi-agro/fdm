import type { Ticket } from "@nmi-agro/fdm-helpdesk"
import { NavLink, useLocation } from "react-router"
import { cn } from "@/app/lib/utils"

export function TicketCard({ ticket, href }: { ticket: Ticket; href: string }) {
    const { pathname, search } = useLocation()
    const domainUrl = `${pathname}${search}`
    const isSelected = domainUrl.startsWith(href)

    const label = ticket.subject ?? "Ticket"

    return (
        <NavLink
            key={ticket.ticket_id}
            to={href}
            aria-current={isSelected ? "page" : undefined}
            aria-label={label}
            className={cn(
                "block justify-start p-4 transition-[background-color] duration-300",
                isSelected
                    ? "bg-muted hover:bg-muted "
                    : "hover:bg-transparent",
            )}
        >
            <p>{label}</p>
        </NavLink>
    )
}
