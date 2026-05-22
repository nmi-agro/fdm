import type { Ticket } from "@nmi-agro/fdm-helpdesk"
import { formatDate } from "date-fns"
import { nl } from "date-fns/locale"
import { NavLink, useLocation } from "react-router"
import { cn } from "@/app/lib/utils"
import type { HelpdeskUser } from "./types"

export function TicketCard({
    ticket,
    principal,
    href,
}: {
    ticket: Ticket
    principal: HelpdeskUser | undefined
    href: string
}) {
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
                "block justify-start p-4 transition-[background-color] duration-300 border-b border-gray-300",
                isSelected
                    ? "bg-muted hover:bg-muted "
                    : "hover:bg-transparent",
            )}
        >
            <p>{label}</p>
            <p className="text-sm">
                ${ticket.ticket_ref} door{" "}
                {principal?.displayUserName ?? "onbekend"} op{" "}
                {formatDate(ticket.created, "PP", { locale: nl })}
            </p>
        </NavLink>
    )
}
