import type { TagSummary, Ticket, TicketFilters, TicketSorting } from "@nmi-agro/fdm-helpdesk"
import throttle from "lodash.throttle"
import { ArrowUpDown, ChevronLeft, Filter, Plus, X } from "lucide-react"
import { Dialog } from "radix-ui"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { NavLink, Outlet, useLocation, useParams, useSearchParams } from "react-router"
import { cn } from "@/app/lib/utils"
import { Paginator } from "~/components/custom/paginator"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { Empty, EmptyContent, EmptyDescription, EmptyTitle } from "~/components/ui/empty"
import { Input } from "~/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover"
import { Sheet, SheetClose, SheetPortal } from "~/components/ui/sheet"
import { useIsXl } from "~/hooks/use-is-xl"
import type { HelpdeskUser } from "./types"
import { useCurrentHelpdeskPage } from "./navigation"
import { TicketSearch } from "./search"
import { TicketCard } from "./ticket-card"
import { TicketFilterSchema, TicketSortingSchema } from "./ticket-filter-schema"
import { TICKET_PRIORITY } from "./ticket-priority"

export const TICKET_VIEWER_PAGE_SIZE = 20

/** Count how many user-facing filters are active (excludes pagination) */
function countActiveFilters(filters: TicketFilters): number {
  const { pageOffset: _o, pageLimit: _l, ...userFilters } = filters
  return Object.entries(userFilters).filter(([k, v]) => {
    if (k === "maxPriority" || k === "text") return false
    if (v === undefined || v === null || v === "") return false
    if (Array.isArray(v)) return v.length > 0
    return true
  }).length
}

function TicketList({
  tickets,
  totalTicketCount,
  toPrefix,
  principalLookup,
  isAgent,
  availableTags,
}: {
  tickets: Ticket[]
  totalTicketCount: number
  toPrefix: string
  principalLookup: Map<string, HelpdeskUser>
  isAgent: boolean
  availableTags: TagSummary[]
}) {
  const location = useLocation()
  const currentPage = useCurrentHelpdeskPage()
  const isAgentView = currentPage === "inbox" || currentPage === "all_tickets"

  // For navigation with filters
  const [searchParams, setSearchParams] = useSearchParams()

  // For controlling the TicketSearch
  const [filters, setFilters] = useState<TicketFilters>(() => {
    try {
      const initialFilters = JSON.parse(searchParams.get("filters") ?? "{}")
      return TicketFilterSchema.parse(initialFilters)
    } catch (err) {
      console.error(err)
      return {}
    }
  })

  // For controlling the sorting
  const [sorting, setSorting] = useState<TicketSorting>(() => {
    const defaultSorting = filters.text && filters.text.length > 0 ? "text_relevance" : "created"
    try {
      const initialSorting = searchParams.get("sorting") ?? defaultSorting
      return TicketSortingSchema.parse(initialSorting)
    } catch (err) {
      console.error(err)
      return defaultSorting
    }
  })

  // For setting search params in a debounced manner
  const searchParamsToNavigateTo = useRef({
    filters: {} as TicketFilters,
    sorting: "created" as TicketSorting,
  })

  const navigateWithFilters = useMemo(
    () =>
      throttle(
        () => {
          setSearchParams((searchParams) => {
            searchParams.set("filters", JSON.stringify(searchParamsToNavigateTo.current.filters))
            searchParams.set("sorting", searchParamsToNavigateTo.current.sorting)
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
    searchParamsToNavigateTo.current.filters = filters
    navigateWithFilters()
  }

  function handleNewSorting(sorting: TicketSorting) {
    setSorting(sorting)
    searchParamsToNavigateTo.current.sorting = sorting
    navigateWithFilters()
  }

  return (
    <nav className="box-border flex h-full flex-col gap-2">
      <div className="flex flex-row items-center gap-1 p-1">
        <Input
          value={filters.text ?? ""}
          placeholder="Zoeken..."
          onInput={(e) => {
            handleNewFilters({
              ...filters,
              text: e.currentTarget.value.length === 0 ? undefined : e.currentTarget.value,
            })
          }}
        />
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              title="Filters"
              className="relative ml-auto block size-auto has-[>svg]:p-2"
            >
              <Filter className="mx-auto" />
              {countActiveFilters(filters) > 0 && (
                <Badge className="absolute -top-1.5 -right-1.5 size-4 justify-center p-0 text-[10px]">
                  {countActiveFilters(filters)}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-2">
            <h2 className="mb-3 text-sm font-semibold">Filters wijzigen</h2>
            <TicketSearch
              filters={filters}
              setFilters={handleNewFilters}
              isAgent={isAgent}
              availableTags={availableTags}
            />
          </PopoverContent>
        </Popover>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              title="Sorteren"
              className="relative ml-auto block size-auto has-[>svg]:p-2"
            >
              <ArrowUpDown className="mx-auto" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="p-2">
            <DropdownMenuLabel className="mb-3 text-sm font-semibold">Sorteren</DropdownMenuLabel>
            <DropdownMenuCheckboxItem
              checked={sorting === "created"}
              onClick={() => handleNewSorting("created")}
            >
              Aangemaakt op
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={sorting === "priority"}
              onClick={() => handleNewSorting("priority")}
            >
              Prioriteit
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="grow overflow-auto">
        {tickets.length === 0 ? (
          <Empty className="border-none">
            <EmptyContent>
              <EmptyTitle>Geen tickets gevonden</EmptyTitle>
              {isAgentView ? (
                <EmptyDescription>
                  Er zijn momenteel geen tickets die aan de huidige filters voldoen.
                </EmptyDescription>
              ) : (
                <>
                  <EmptyDescription>
                    U heeft nog geen tickets aangemaakt. Stel een vraag en een medewerker neemt
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
              principal={ticket.requester_id ? principalLookup.get(ticket.requester_id) : undefined}
              href={`${toPrefix}/${ticket.ticket_id}${location.search}`}
              showAssignees={isAgentView}
              badge={
                sorting === "priority" ? (
                  <Badge variant="outline" className="text-muted-foreground">
                    {TICKET_PRIORITY.find((item) => item.value === ticket.priority)?.label ??
                      ticket.priority}
                  </Badge>
                ) : null
              }
            />
          ))
        )}
      </div>
      <Paginator totalItems={totalTicketCount} pageSize={TICKET_VIEWER_PAGE_SIZE} />
    </nav>
  )
}

export function TicketViewer({
  tickets,
  totalTicketCount,
  toPrefix,
  principalLookup,
  helpdeskReadPermission,
  availableTags,
}: {
  tickets: Ticket[]
  totalTicketCount: number
  toPrefix: string
  principalLookup: Map<string, HelpdeskUser>
  helpdeskReadPermission: boolean
  availableTags: TagSummary[]
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
    availableTags: availableTags,
  }

  return (
    <div
      ref={containerRef}
      className="relative flex h-[calc(100vh-16*calc(var(--spacing)))] flex-row"
    >
      {/* Static sidebar — only rendered on xl+ screens */}
      {isXl && (
        <aside className="border-sidebar-border bg-background flex w-100 shrink-0 flex-col border-r">
          <TicketList {...ticketListProps} />
        </aside>
      )}

      {/* Sheet sidebar — only rendered on narrow screens (< xl).
                Portalled into this wrapper div so it stays within the SidebarInset
                and never overlaps the main navigation sidebar. No overlay is rendered
                since the sheet itself fully covers the content area. */}
      {!isXl && container && (
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen} modal={false}>
          <SheetPortal container={container}>
            <Dialog.Content
              aria-label="Tickets"
              className="bg-background border-sidebar-border data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left absolute inset-y-0 top-0 left-0 z-50 flex h-full w-full flex-col border-r transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500"
            >
              <SheetClose asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "absolute -top-8 right-8 translate-x-1/2 -translate-y-1/2",
                    !params.ticket_id && "hidden",
                  )}
                >
                  <X />
                  <span className="sr-only">Sluit zijbalk</span>
                </Button>
              </SheetClose>
              <div className="min-h-0 flex-1">
                <TicketList {...ticketListProps} />
              </div>
            </Dialog.Content>
          </SheetPortal>
        </Sheet>
      )}

      <div className="min-w-0 grow self-stretch overflow-y-auto">
        {/* Button to reopen the Sheet on narrow screens */}
        {!isXl && (
          <Button variant="outline" className="m-6 mb-0" onClick={() => setSidebarOpen(true)}>
            <ChevronLeft />
            Tickets
          </Button>
        )}
        <Outlet />
      </div>
    </div>
  )
}
