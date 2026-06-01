import type { Ticket } from "@nmi-agro/fdm-helpdesk"
import { ChevronLeft, Cross, X } from "lucide-react"
import { useEffect, useState } from "react"
import { Outlet, useLocation, useParams } from "react-router"
import { cn } from "@/app/lib/utils"
import { getPageSearch, Paginator } from "~/components/custom/paginator"
import { Button } from "~/components/ui/button"
import { Empty, EmptyDescription, EmptyTitle } from "~/components/ui/empty"
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
    const params = useParams()
    const [sidebarActive, setSidebarActive] = useState(!params.ticket_id)

    useEffect(() => {
        setSidebarActive(!params.ticket_id)
    }, [params.ticket_id])

    return (
        <div className="relative flex flex-row h-[calc(100vh-16*calc(var(--spacing)))]">
            <aside
                className={cn(
                    "absolute top-0 mx-0 w-full h-full shrink-0 border-r border-sidebar-border bg-background",
                    "xl:static! xl:w-100",
                    "transition-transform duration-300",
                    !sidebarActive && "-translate-x-full xl:translate-x-0",
                )}
            >
                <nav className="flex flex-col gap-2 xl:overflow-visible h-full box-border">
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
            {/* Sidebar close button for narrow screens */}
            <Button
                variant="ghost"
                className={cn(
                    "absolute right-8 -top-8 translate-x-1/2 -translate-y-1/2 xl:hidden",
                    !(params.ticket_id && sidebarActive) && "hidden",
                )}
                onClick={() => setSidebarActive(false)}
            >
                <X />
            </Button>
            <div className="grow min-w-0 overflow-y-auto self-stretch">
                {/* Sidebar open button for narrow screens */}
                <Button
                    variant="outline"
                    className="m-6 mb-0 xl:hidden"
                    onClick={() => setSidebarActive(true)}
                >
                    <ChevronLeft />
                    Tickets
                </Button>
                <Outlet />
            </div>
        </div>
    )
}
