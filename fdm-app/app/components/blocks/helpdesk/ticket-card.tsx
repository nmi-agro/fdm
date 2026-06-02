import type { Ticket } from "@nmi-agro/fdm-helpdesk"
import { formatDate } from "date-fns"
import { nl } from "date-fns/locale"
import { NavLink, useLocation } from "react-router"
import { cn } from "@/app/lib/utils"
import { Badge } from "~/components/ui/badge"
import { TICKET_STATUS } from "./ticket"
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

    const { label: statusLabel, color: statusColor } = TICKET_STATUS.find(
        (item) => item.value === ticket.status,
    ) ?? { label: ticket.status, color: "#777777" }

    const isViewed = !!ticket.viewed_at

    return (
        <NavLink
            key={ticket.ticket_id}
            to={href}
            aria-current={isSelected ? "page" : undefined}
            aria-label={label}
            className={cn(
                "block border-b border-gray-300",
                isSelected
                    ? "bg-muted hover:bg-muted "
                    : "hover:bg-transparent",
            )}
        >
            <div
                className={cn(
                    "p-4 transition-[background-color] duration-300 border-l-4 space-y-2",
                    isViewed ? "border-transparent" : "border-blue-400",
                    isSelected
                        ? "bg-muted hover:bg-muted "
                        : "hover:bg-transparent",
                )}
            >
                <div className="text-sm">
                    <svg
                        aria-label={statusLabel}
                        className="float-left size-4"
                        style={{ color: statusColor }}
                        viewBox="0 0 24 24"
                        fill="currentColor"
                    >
                        <title>{statusLabel}</title>
                        <circle cx="12" cy="12" r="5" />
                    </svg>
                    {/* overflow: hidden puts the text next to the dot and doesn't wrap it around */}
                    <div className="overflow-hidden">{label}</div>
                </div>
                <div className="text-sm text-muted-foreground">
                    <Badge variant="outline" className="px-1 text-1em">
                        {ticket.ticket_ref}
                    </Badge>{" "}
                    {principal?.displayUserName ?? "onbekend"},{" "}
                    {formatDate(ticket.created, "PP", { locale: nl })}
                </div>
            </div>
        </NavLink>
    )
}
