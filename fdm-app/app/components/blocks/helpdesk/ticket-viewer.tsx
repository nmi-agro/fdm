import type { Ticket } from "@nmi-agro/fdm-helpdesk"
import { ChevronLeft, Plus, X } from "lucide-react"
import { Dialog } from "radix-ui"
import { useCallback, useEffect, useState } from "react"
import { NavLink, Outlet, useLocation, useParams } from "react-router"
import { cn } from "@/app/lib/utils"
import { getPageSearch, Paginator } from "~/components/custom/paginator"
import { Button } from "~/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyTitle } from "~/components/ui/empty"
import { Sheet, SheetClose, SheetPortal } from "~/components/ui/sheet"
import { useIsXl } from "~/hooks/use-is-xl"
import { useCurrentHelpdeskPage } from "./navigation"
import { TicketCard } from "./ticket-card"
import type { HelpdeskUser } from "./types"

export const TICKET_VIEWER_PAGE_SIZE = 20

function TicketList({
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
    const currentPage = useCurrentHelpdeskPage()
    const isAgentView =
        currentPage === "inbox" || currentPage === "all_tickets"
    return (
        <nav className="flex flex-col gap-2 h-full box-border">
            <div className="overflow-auto grow">
                {tickets.length === 0 ? (
                    <Empty className="border-none">
                        <EmptyContent>
                            <EmptyTitle>Geen tickets gevonden</EmptyTitle>
                            {isAgentView ? (
                                <EmptyDescription>
                                    Er zijn momenteel geen tickets die aan de
                                    huidige filters voldoen.
                                </EmptyDescription>
                            ) : (
                                <>
                                    <EmptyDescription>
                                        U heeft nog geen tickets aangemaakt. Stel
                                        een vraag en een medewerker neemt contact
                                        met u op.
                                    </EmptyDescription>
                                    <Button asChild size="sm" className="mt-2">
                                        <NavLink to="/support/new">
                                            <Plus className="size-4" />
                                            Nieuw ticket aanmaken
                                        </NavLink>
                                    </Button>
                                </>
                            )}
                        </EmptyContent>
                    </Empty>
                ) : (
                    tickets.map((ticket) => (
                        <TicketCard
                            key={ticket.ticket_id}
                            ticket={ticket}
                            principal={
                                ticket.requester_id
                                    ? principalLookup.get(ticket.requester_id)
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
    )
}

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
    const params = useParams()
    const isXl = useIsXl()
    const [sidebarOpen, setSidebarOpen] = useState(!params.ticket_id)
    // Track the container element so SheetPortal can scope the Sheet within this div.
    const [container, setContainer] = useState<HTMLDivElement | null>(null)
    const containerRef = useCallback((node: HTMLDivElement | null) => {
        setContainer(node)
    }, [])

    useEffect(() => {
        setSidebarOpen(!params.ticket_id)
    }, [params.ticket_id])

    const ticketListProps = {
        tickets,
        totalTicketCount,
        toPrefix,
        principalLookup,
    }

    return (
        <div
            ref={containerRef}
            className="relative flex flex-row h-[calc(100vh-16*calc(var(--spacing)))]"
        >
            {/* Static sidebar — only rendered on xl+ screens */}
            {isXl && (
                <aside className="flex flex-col w-100 shrink-0 border-r border-sidebar-border bg-background">
                    <TicketList {...ticketListProps} />
                </aside>
            )}

            {/* Sheet sidebar — only rendered on narrow screens (< xl).
                Portalled into this wrapper div so it stays within the SidebarInset
                and never overlaps the main navigation sidebar. No overlay is rendered
                since the sheet itself fully covers the content area. */}
            {!isXl && container && (
                <Sheet
                    open={sidebarOpen}
                    onOpenChange={setSidebarOpen}
                    modal={false}
                >
                    <SheetPortal container={container}>
                        <Dialog.Content
                            aria-label="Tickets"
                            className="absolute inset-y-0 left-0 z-50 flex flex-col w-full h-full bg-background border-r border-sidebar-border transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left"
                        >
                            <SheetClose asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className={cn(
                                        "absolute right-8 -top-8 translate-x-1/2 -translate-y-1/2",
                                        !params.ticket_id && "hidden",
                                    )}
                                >
                                    <X />
                                    <span className="sr-only">
                                        Sluit zijbalk
                                    </span>
                                </Button>
                            </SheetClose>
                            <div className="flex-1 min-h-0">
                                <TicketList {...ticketListProps} />
                            </div>
                        </Dialog.Content>
                    </SheetPortal>
                </Sheet>
            )}

            <div className="grow min-w-0 overflow-y-auto self-stretch">
                {/* Button to reopen the Sheet on narrow screens */}
                {!isXl && (
                    <Button
                        variant="outline"
                        className="m-6 mb-0"
                        onClick={() => setSidebarOpen(true)}
                    >
                        <ChevronLeft />
                        Tickets
                    </Button>
                )}
                <Outlet />
            </div>
        </div>
    )
}
