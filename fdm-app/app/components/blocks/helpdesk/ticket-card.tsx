import type { Ticket } from "@nmi-agro/fdm-helpdesk"
import type { ReactNode } from "react"
import { formatDate } from "date-fns"
import { nl } from "date-fns/locale"
import { NavLink, useParams } from "react-router"
import { cn } from "@/app/lib/utils"
import type { HelpdeskUser } from "./types"
import { TICKET_STATUS, TicketStatusDot } from "./ticket-status"

export function TicketCard({
  ticket,
  principal,
  href,
  showAssignees = false,
  badge = null,
}: {
  ticket: Ticket
  principal: HelpdeskUser | undefined
  href: string
  showAssignees?: boolean
  badge?: ReactNode
}) {
  const params = useParams()
  const isSelected = params.ticket_id === ticket.ticket_id

  const label = ticket.subject ?? "Ticket"

  const { label: statusLabel } = TICKET_STATUS.find((item) => item.value === ticket.status) ?? {
    label: ticket.status,
  }

  const isViewed = !!ticket.viewed_at

  const assigneeText =
    showAssignees && ticket.assignees.length > 0
      ? ticket.assignees
          .slice(0, 3)
          .map((a) => a.display_name)
          .join(", ") +
        (ticket.assignees.length > 3 ? ` en ${ticket.assignees.length - 3} meer` : "")
      : null

  return (
    <NavLink
      key={ticket.ticket_id}
      to={href}
      aria-current={isSelected ? "page" : undefined}
      aria-label={label}
      className={cn(
        "block border-b border-gray-300",
        isSelected ? "bg-muted hover:bg-muted " : "hover:bg-transparent",
      )}
    >
      <div
        className={cn(
          "space-y-1.5 border-l-4 p-4 transition-[background-color] duration-300",
          isViewed ? "border-transparent" : "border-blue-400",
          isSelected ? "bg-muted hover:bg-muted " : "hover:bg-transparent",
        )}
      >
        <div className="flex items-start gap-2 text-sm">
          <TicketStatusDot ticket={ticket} className="mt-0.5 shrink-0" />
          <span className="leading-snug">{label}</span>
        </div>
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5 ps-6 text-xs">
          <span className="font-mono">{ticket.ticket_ref}</span>
          <span aria-hidden="true">·</span>
          <span>{statusLabel}</span>
          <span aria-hidden="true">·</span>
          <span>{principal?.displayUserName ?? ticket.requester_email ?? "onbekend"}</span>
          <span aria-hidden="true">·</span>
          <span>{formatDate(ticket.created, "PP", { locale: nl })}</span>
          {assigneeText && (
            <>
              <span aria-hidden="true">·</span>
              <span>Toegewezen: {assigneeText}</span>
            </>
          )}
          <span className="ms-auto">{badge}</span>
        </div>
      </div>
    </NavLink>
  )
}
