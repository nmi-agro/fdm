import type { Ticket, TicketFilters } from "@nmi-agro/fdm-helpdesk"
import throttle from "lodash.throttle"
import { ChevronLeft, Filter, Plus, X } from "lucide-react"
import { Dialog } from "radix-ui"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
    NavLink,
    Outlet,
    useLocation,
    useParams,
    useSearchParams,
} from "react-router"
import { cn } from "@/app/lib/utils"
import { getPageSearch, Paginator } from "~/components/custom/paginator"
import { Button } from "~/components/ui/button"
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyTitle,
} from "~/components/ui/empty"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "~/components/ui/popover"
import { Sheet, SheetClose, SheetPortal } from "~/components/ui/sheet"
import { useIsXl } from "~/hooks/use-is-xl"
import { useCurrentHelpdeskPage } from "./navigation"
import { TicketSearch } from "./search"
import { TicketCard } from "./ticket-card"
import { TicketFilterSchema } from "./ticket-filter-schema"
import type { HelpdeskUser } from "./types"

export const TICKET_VIEWER_PAGE_SIZE = 20

function TicketList({
    tickets,
    totalTicketCount,
    toPrefix,
    principalLookup,
    isAgent,
}: {
    tickets: Ticket[]
    totalTicketCount: number
    toPrefix: string
    principalLookup: Map<string, HelpdeskUser>
    isAgent: boolean
}) {
    const location = useLocation()
    const currentPage = useCurrentHelpdeskPage()
    const isAgentView = currentPage === "inbox" || currentPage === "all_tickets"

    // For navigation with filters
    const [searchParams, setSearchParams] = useSearchParams()

    // For controlling the TicketSearch
    const [filters, setFilters] = useState<TicketFilters>(() => {
        try {
            const initialFilters = JSON.parse(
                searchParams.get("filters") ?? "{}",
            )
            return TicketFilterSchema.parse(initialFilters)
        } catch (err) {
            console.error(err)
            return {}
        }
    })

    // For setting search params in a debounced manner
    const searchParamsToNavigateTo = useRef<TicketFilters>({})

    const navigateWithFilters = useMemo(
        () =>
            throttle(
                () => {
                    setSearchParams((searchParams) => {
                        searchParams.set(
                            "filters",
                            JSON.stringify(searchParamsToNavigateTo.current),
                        )
                        return searchParams
                    })
                },
                300,
                { trailing: true },
            ),
        [setSearchParams],
    )

    function handleNewFilters(filters: TicketFilters) {
        setFilters(filters)
        searchParamsToNavigateTo.current = filters
        navigateWithFilters()
    }

    return (
        <nav className="flex flex-col gap-2 h-full box-border">
            <div>
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="ghost" className="block ml-auto">
                            <Filter />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-2">
                        <h1>Filters Wijzigen</h1>
                        <TicketSearch
                            filters={filters}
                            setFilters={handleNewFilters}
                            isAgent={isAgent}
                        />
                    </PopoverContent>
                </Popover>
            </div>
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
                                        U heeft nog geen tickets aangemaakt.
                                        Stel een vraag en een medewerker neemt
                                        contact met u op.
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
                            showAssignees={isAgentView}
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
    helpdeskReadPermission,
}: {
    tickets: Ticket[]
    totalTicketCount: number
    toPrefix: string
    principalLookup: Map<string, HelpdeskUser>
    helpdeskReadPermission: boolean
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
        isAgent: helpdeskReadPermission,
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
                            className="absolute inset-y-0 left-0 top-0 z-50 flex flex-col w-full h-full bg-background border-r border-sidebar-border transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left"
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
