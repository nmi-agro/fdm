import type { Ticket } from "@nmi-agro/fdm-helpdesk"
import { formatDate } from "date-fns"
import { nl } from "date-fns/locale"
import { NavLink, useLocation } from "react-router"
import { cn } from "@/app/lib/utils"
import { Badge } from "~/components/ui/badge"
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

    const isResolved = !!ticket.closed_at
    const statusLabel = isResolved ? "Opgelost" : "Open"

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
            <div>
                <svg
                    aria-label={statusLabel}
                    className={cn(
                        "inline size-[1em]",
                        isResolved ? "text-[#aa00aa]" : "text-[#00aa00]",
                    )}
                    viewBox="0 0 24 24"
                    fill="currentColor"
                >
                    <title>{statusLabel}</title>
                    <circle cx="12" cy="12" r="4" />
                </svg>
                {label}
            </div>
            <div className="text-sm text-muted-foreground">
                <Badge variant="outline" className="px-1 text-1em">
                    {ticket.ticket_ref}
                </Badge>{" "}
                door {principal?.displayUserName ?? "onbekend"} op{" "}
                {formatDate(ticket.created, "PP", { locale: nl })}
            </div>
        </NavLink>
    )
}
