import type { Ticket } from "@nmi-agro/fdm-helpdesk"
import { useState } from "react"
import { Outlet, useLocation } from "react-router"
import { getPageSearch, Paginator } from "~/components/custom/paginator"
import { Button } from "~/components/ui/button"
import { Empty, EmptyDescription, EmptyTitle } from "~/components/ui/empty"
import { Input } from "~/components/ui/input"
import { TicketCard } from "./ticket-card"
import type { HelpdeskUser } from "./types"

export const TICKET_VIEWER_PAGE_SIZE = 20
export function TicketViewer({
    tickets,
    totalTicketCount,
    toPrefix,
    principalLookup,
}: {
    tickets: Ticket[]
    totalTicketCount: number
    toPrefix: string
    principalLookup: Map<string, HelpdeskUser>
}) {
    const location = useLocation()

    return (
        <div className="flex flex-col space-y-6 lg:flex-row lg:space-x-4 xl:space-x-8 lg:space-y-0 h-full">
            <aside className="lg:w-40 xl:w-70 shrink-0 self-stretch border-r border-sidebar-border">
                <nav className="flex flex-col space-x-2 pb-2 lg:overflow-visible lg:pb-0 lg:flex-col lg:space-x-0 lg:space-y-1 h-full box-border">
                    <div className="overflow-auto grow">
                        {tickets.length === 0 ? (
                            <Empty>
                                <EmptyTitle>Geen tickets gevonden</EmptyTitle>
                                <EmptyDescription>
                                    Probeer om jouw filters te wijzigen
                                </EmptyDescription>
                            </Empty>
                        ) : (
                            tickets.map((ticket) => (
                                <TicketCard
                                    key={ticket.ticket_id}
                                    ticket={ticket}
                                    principal={
                                        ticket.requester_id
                                            ? principalLookup.get(
                                                  ticket.requester_id,
                                              )
                                            : undefined
                                    }
                                    href={`${toPrefix}/${ticket.ticket_id}${getPageSearch(location.search, TICKET_VIEWER_PAGE_SIZE, 0)}`}
                                />
                            ))
                        )}
                    </div>
                    <Paginator
                        totalItems={totalTicketCount}
                        pageSize={TICKET_VIEWER_PAGE_SIZE}
                    />
                </nav>
            </aside>

            <div className="flex-1 min-w-0">
                <Outlet />
            </div>
        </div>
    )
}

function PaginationCurrent({
    value,
    onValueChange,
}: {
    value: number
    onValueChange: (v: number) => unknown
}) {
    const [active, setActive] = useState(false)
    return active ? (
        <Input
            type="number"
            onLoad={(e) => e.currentTarget.focus()}
            onKeyDown={(e) => {
                if (e.key !== "Enter") return
                let newValue = 0
                try {
                    newValue = Number.parseInt(e.currentTarget.value)
                } catch (_) {
                    return
                }
                onValueChange(newValue)
                setActive(false)
            }}
            onBlur={(e) => {
                setActive(false)
            }}
        />
    ) : (
        <Button variant="link" onClick={() => setActive(true)}>
            {value + 1}
        </Button>
    )
}
