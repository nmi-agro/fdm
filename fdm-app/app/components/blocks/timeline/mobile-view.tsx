import { format, isToday } from "date-fns"
import { nl } from "date-fns/locale"
import { ChevronRight, CircleStop, Sprout, TestTube2, Wheat } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router"
import type {
  FertilizerTypeInfo,
  TimelineField,
  TimelineFilters,
} from "~/components/blocks/timeline/gantt-view"
import {
  EVENT_TYPE_COLOR,
  getFertilizerKindColor,
} from "~/components/blocks/timeline/timeline-colors"
import { getFertilizerCategoryFromRvoCode, isRenureRvoCode } from "~/components/blocks/fertilizer/utils"
import {
  filterEventsByType,
  flattenEvents,
  formatEventDateHeader,
  getActiveCultivations,
  getMonthYearOptions,
  groupEventsByDate,
  groupEventsByField,
  isInMonthYear,
  type TimelineEvent,
  type TimelineEventType,
} from "~/components/blocks/timeline/timeline-events"
import { TimelineFiltersPopover } from "~/components/blocks/timeline/timeline-filters"
import { getCultivationColor } from "~/components/custom/cultivation-colors"
import { FertilizerIcon } from "~/components/custom/fertilizer-icon"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent } from "~/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "~/components/ui/empty"
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group"

const INITIAL_GROUPS = 10
const GROUPS_PER_LOAD = 10

const eventTypeLabel: Record<TimelineEventType, string> = {
  fertilizer: "Bemesting",
  harvest: "Oogst",
  soil_sampling: "Bodemanalyse",
  cultivation_start: "Gewas gestart",
  cultivation_end: "Gewas beëindigd",
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "")
  const bigint = Number.parseInt(clean, 16)
  const r = (bigint >> 16) & 255
  const g = (bigint >> 8) & 255
  const b = bigint & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function eventColor(event: TimelineEvent): string {
  switch (event.type) {
    case "fertilizer": {
      const isRenure = isRenureRvoCode(event.p_type_rvo)
      return getFertilizerKindColor(isRenure ? "renure" : event.p_type)
    }
    case "harvest":
      return EVENT_TYPE_COLOR.harvest
    case "soil_sampling":
      return EVENT_TYPE_COLOR.soil_sampling
    case "cultivation_start":
    case "cultivation_end":
      return getCultivationColor(event.cultivationType ?? undefined)
    default:
      return "#6b7280"
  }
}

function EventTypeIcon({ event }: { event: TimelineEvent }) {
  const color = eventColor(event)
  const bg = hexToRgba(color, 0.12)

  let icon: React.ReactNode
  if (event.type === "fertilizer") {
    icon = <FertilizerIcon p_type={getFertilizerCategoryFromRvoCode(event.p_type_rvo)} />
  } else if (event.type === "harvest") {
    icon = <Wheat className="size-4 fill-current" />
  } else if (event.type === "soil_sampling") {
    icon = <TestTube2 className="size-4 fill-current" />
  } else if (event.type === "cultivation_start") {
    icon = <Sprout className="size-4 fill-current" />
  } else {
    icon = <CircleStop className="size-4" />
  }

  return (
    <div
      aria-hidden="true"
      className="flex size-9 shrink-0 items-center justify-center rounded-md"
      style={{ backgroundColor: bg, color }}
    >
      {icon}
    </div>
  )
}

function EventCard({ event }: { event: TimelineEvent }) {
  const navigate = useNavigate()

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <button
          className="focus-visible:ring-ring/50 flex w-full items-start gap-3 p-3 text-left outline-none focus-visible:ring-[3px]"
          onClick={() => void navigate(event.href)}
          type="button"
        >
          <EventTypeIcon event={event} />
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex items-center gap-2">
              <Badge
                className="max-w-[60%] truncate text-xs"
                title={event.fieldName}
                variant="secondary"
              >
                {event.fieldName}
              </Badge>
              <span className="text-muted-foreground shrink-0 text-xs">
                {eventTypeLabel[event.type]}
              </span>
            </div>
            <p className="text-sm font-medium break-words">{event.label}</p>
            {event.sublabel && (
              <p className="text-muted-foreground text-sm break-words">{event.sublabel}</p>
            )}
          </div>
        </button>
      </CardContent>
    </Card>
  )
}

function ActiveCultivationBar({
  cultivations,
  onSelect,
}: {
  cultivations: ReturnType<typeof getActiveCultivations>
  onSelect: (fieldId: string) => void
}) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const updateFades = () => {
      setCanScrollLeft(el.scrollLeft > 0)
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
    }
    updateFades()
    el.addEventListener("scroll", updateFades)
    window.addEventListener("resize", updateFades)
    return () => {
      el.removeEventListener("scroll", updateFades)
      window.removeEventListener("resize", updateFades)
    }
  }, [cultivations])

  if (cultivations.length === 0) return null

  return (
    <div className="bg-background sticky top-0 z-20 -mx-4 px-4 py-2">
      {/* Fades the edges so the pill row visibly hints there's more content to scroll to,
      instead of looking like a fixed, fully-visible list. */}
      <div className="relative">
        <div
          className="scrollbar-none overflow-x-auto [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          ref={scrollerRef}
        >
          <div className="flex w-max gap-2">
            {cultivations.map((cultivation) => {
              const color = getCultivationColor(cultivation.b_lu_croprotation ?? undefined)
              return (
                <button
                  className="focus-visible:ring-ring/50 flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs outline-none focus-visible:ring-[3px]"
                  key={`${cultivation.fieldId}-${cultivation.b_lu}`}
                  onClick={() => onSelect(cultivation.fieldId)}
                  type="button"
                >
                  <span
                    aria-hidden="true"
                    className="inline-block size-2 rounded-sm"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-muted-foreground">{cultivation.fieldName}:</span>
                  <span className="font-medium">{cultivation.b_lu_name ?? "Onbekend"}</span>
                </button>
              )
            })}
          </div>
        </div>
        {canScrollLeft && (
          <div
            aria-hidden="true"
            className="from-background pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r to-transparent"
          />
        )}
        {canScrollRight && (
          <div
            aria-hidden="true"
            className="from-background pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l to-transparent"
          />
        )}
      </div>
    </div>
  )
}

function DateGroupedFeed({
  groups,
  stickyOffset,
}: {
  groups: ReturnType<typeof groupEventsByDate>
  stickyOffset: number
}) {
  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const isTodayGroup = isToday(group.date)
        return (
          <section className="space-y-2" key={group.key}>
            <h3
              className={`bg-background sticky z-10 py-2 text-sm font-semibold ${
                isTodayGroup ? "text-primary" : "text-muted-foreground"
              }`}
              style={{ top: stickyOffset }}
            >
              {isTodayGroup
                ? `Vandaag - ${formatEventDateHeader(group.date)}`
                : formatEventDateHeader(group.date)}
            </h3>
            <div className="space-y-2">
              {group.events.map((event) => (
                <EventCard event={event} key={event.id} />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function FieldGroupedView({
  groups,
  expandedFields,
  onToggleField,
  fieldHeaderRefs,
}: {
  groups: ReturnType<typeof groupEventsByField>
  expandedFields: Set<string>
  onToggleField: (fieldId: string) => void
  fieldHeaderRefs: React.MutableRefObject<Map<string, HTMLDivElement | null>>
}) {
  return (
    <div className="space-y-4">
      {groups.map(({ field, events }) => {
        const active = getActiveCultivations([field])
        const isOpen = expandedFields.has(field.b_id)

        return (
          <Collapsible
            key={field.b_id}
            onOpenChange={() => onToggleField(field.b_id)}
            open={isOpen}
          >
            <div
              ref={(element) => {
                fieldHeaderRefs.current.set(field.b_id, element)
              }}
            >
              <CollapsibleTrigger asChild>
                <button
                  className="focus-visible:ring-ring/50 bg-card flex w-full items-center justify-between rounded-lg border p-3 text-left outline-none focus-visible:ring-[3px]"
                  type="button"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="min-w-0 flex-1 truncate text-xs font-semibold tracking-wide uppercase"
                        title={field.b_name}
                      >
                        {field.b_name}
                      </span>
                      <ChevronRight
                        aria-hidden="true"
                        className={`text-muted-foreground size-4 shrink-0 transition-transform ${
                          isOpen ? "rotate-90" : ""
                        }`}
                      />
                    </div>
                    {active.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {active.map((cultivation) => {
                          const color = getCultivationColor(
                            cultivation.b_lu_croprotation ?? undefined,
                          )
                          const period = cultivation.b_lu_end
                            ? `${format(cultivation.b_lu_start, "d MMM yyyy", { locale: nl })} - ${format(
                                cultivation.b_lu_end,
                                "d MMM yyyy",
                                { locale: nl },
                              )}`
                            : `${format(cultivation.b_lu_start, "d MMM yyyy", { locale: nl })} - heden`
                          return (
                            <div
                              className="flex min-w-0 items-center gap-1.5 text-xs"
                              key={cultivation.b_lu}
                            >
                              <span
                                aria-hidden="true"
                                className="inline-block h-4 w-1 shrink-0 rounded-full"
                                style={{ backgroundColor: color }}
                              />
                              <span className="max-w-40 truncate font-medium">
                                {cultivation.b_lu_name ?? "Onbekend"}
                              </span>
                              <span className="text-muted-foreground shrink-0">({period})</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </button>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent className="pt-2">
              {events.length === 0 ? (
                <p className="text-muted-foreground px-3 py-2 text-sm">
                  Nog geen gebeurtenissen geregistreerd
                </p>
              ) : (
                <div className="space-y-2">
                  {events.map((event) => (
                    <EventCard event={event} key={event.id} />
                  ))}
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        )
      })}
    </div>
  )
}

export function TimelineMobileView({
  fields,
  fertilizerTypeById,
  b_id_farm,
  calendar,
  filters,
  onFiltersChange,
}: {
  fields: TimelineField[]
  fertilizerTypeById: Map<string, FertilizerTypeInfo>
  b_id_farm: string
  calendar: string
  filters: TimelineFilters
  onFiltersChange: (filters: TimelineFilters) => void
}) {
  const [viewMode, setViewMode] = useState<"date" | "field">("date")
  const [monthYear, setMonthYear] = useState<string>("")
  const [visibleGroupCount, setVisibleGroupCount] = useState(INITIAL_GROUPS)
  const [expandedFields, setExpandedFields] = useState<Set<string>>(
    () => new Set(fields.map((field) => field.b_id)),
  )
  const [cultivationBarHeight, setCultivationBarHeight] = useState(0)

  const sentinelRef = useRef<HTMLDivElement>(null)
  const cultivationBarRef = useRef<HTMLDivElement>(null)
  const fieldHeaderRefs = useRef(new Map<string, HTMLDivElement | null>())
  const scrollToFieldTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const skipNextPaginationResetRef = useRef(false)

  useEffect(() => {
    return () => clearTimeout(scrollToFieldTimeoutRef.current)
  }, [])

  useEffect(() => {
    const node = cultivationBarRef.current
    if (!node || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setCultivationBarHeight(entry.contentRect.height)
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const today = useMemo(() => new Date(), [])

  const visibleFields = useMemo(
    () =>
      fields
        .filter((field) => filters.showBufferStrips || !field.b_bufferstrip)
        .sort((a, b) => b.b_area - a.b_area || a.b_name.localeCompare(b.b_name, "nl")),
    [fields, filters.showBufferStrips],
  )

  useEffect(() => {
    setExpandedFields(new Set(visibleFields.map((field) => field.b_id)))
  }, [visibleFields])

  const events = useMemo(() => {
    const all = flattenEvents(visibleFields, fertilizerTypeById, b_id_farm, calendar)
    return filterEventsByType(all, filters, today)
  }, [visibleFields, fertilizerTypeById, b_id_farm, calendar, filters, today])

  const monthYearOptions = useMemo(() => {
    const options = getMonthYearOptions(events)
    return [{ value: "", label: "Alles", date: today }, ...options]
  }, [events, today])

  const filteredEvents = useMemo(() => {
    if (!monthYear) return events
    return events.filter((event) => isInMonthYear(event.date, monthYear))
  }, [events, monthYear])

  const dateGroups = useMemo(() => groupEventsByDate(filteredEvents), [filteredEvents])
  const fieldGroups = useMemo(
    () => groupEventsByField(filteredEvents, visibleFields),
    [filteredEvents, visibleFields],
  )

  useEffect(() => {
    if (skipNextPaginationResetRef.current) {
      skipNextPaginationResetRef.current = false
      return
    }
    setVisibleGroupCount(INITIAL_GROUPS)
  }, [viewMode, monthYear, filters])

  const visibleDateGroups = dateGroups.slice(0, visibleGroupCount)
  const visibleFieldGroups = fieldGroups.slice(0, visibleGroupCount)
  // Only one of the two group lists is on screen at a time (viewMode), but a large farm can
  // have as many fields as it has days with events — without this, switching to "Perceel" would
  // render every field's Collapsible at once instead of loading them incrementally like the
  // date feed already does.
  const currentGroupCount = viewMode === "date" ? dateGroups.length : fieldGroups.length
  const hasMore = visibleGroupCount < currentGroupCount

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore) {
          setVisibleGroupCount((count) => Math.min(count + GROUPS_PER_LOAD, currentGroupCount))
        }
      },
      { rootMargin: "100px" },
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, currentGroupCount])

  const activeCultivations = useMemo(() => getActiveCultivations(visibleFields), [visibleFields])

  function handleSelectCultivation(fieldId: string) {
    skipNextPaginationResetRef.current = true
    setViewMode("field")
    setMonthYear("")
    setExpandedFields((prev) => {
      const next = new Set(prev)
      next.add(fieldId)
      return next
    })
    const targetIndex = fieldGroups.findIndex((group) => group.field.b_id === fieldId)
    if (targetIndex >= 0) {
      const pageContaining = Math.ceil((targetIndex + 1) / GROUPS_PER_LOAD) * GROUPS_PER_LOAD
      setVisibleGroupCount((count) => Math.max(count, pageContaining))
    }
    clearTimeout(scrollToFieldTimeoutRef.current)
    scrollToFieldTimeoutRef.current = setTimeout(() => {
      const header = fieldHeaderRefs.current.get(fieldId)
      header?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 100)
  }

  function toggleField(fieldId: string) {
    setExpandedFields((prev) => {
      const next = new Set(prev)
      if (next.has(fieldId)) next.delete(fieldId)
      else next.add(fieldId)
      return next
    })
  }

  const showEmpty = filteredEvents.length === 0

  return (
    <div className="space-y-4 px-4 py-4">
      <div className="flex items-center gap-2">
        <ToggleGroup
          className="flex-1"
          onValueChange={(value) => {
            if (value) setViewMode(value as "date" | "field")
          }}
          size="lg"
          type="single"
          value={viewMode}
          variant="outline"
        >
          <ToggleGroupItem className="flex-1 text-xs" value="date">
            Datum
          </ToggleGroupItem>
          <ToggleGroupItem className="flex-1 text-xs" value="field">
            Perceel
          </ToggleGroupItem>
        </ToggleGroup>

        <TimelineFiltersPopover
          align="end"
          filters={filters}
          onFiltersChange={onFiltersChange}
          period={{ value: monthYear, options: monthYearOptions, onChange: setMonthYear }}
        />
      </div>

      <div ref={cultivationBarRef}>
        {viewMode === "date" && (
          <ActiveCultivationBar
            cultivations={activeCultivations}
            onSelect={handleSelectCultivation}
          />
        )}
      </div>

      {showEmpty ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Geen gebeurtenissen in deze periode</EmptyTitle>
            <EmptyDescription>
              Er zijn geen gebeurtenissen die overeenkomen met de gekozen periode en filters.
            </EmptyDescription>
          </EmptyHeader>
          {monthYear && (
            <Button onClick={() => setMonthYear("")} variant="outline">
              Toon alle gebeurtenissen
            </Button>
          )}
        </Empty>
      ) : viewMode === "date" ? (
        <>
          <DateGroupedFeed groups={visibleDateGroups} stickyOffset={cultivationBarHeight} />
          {hasMore ? (
            <div aria-hidden className="h-8" ref={sentinelRef} />
          ) : (
            dateGroups.length > INITIAL_GROUPS && (
              <p className="text-muted-foreground py-2 text-center text-xs">Alles geladen</p>
            )
          )}
        </>
      ) : (
        <>
          <FieldGroupedView
            expandedFields={expandedFields}
            fieldHeaderRefs={fieldHeaderRefs}
            groups={visibleFieldGroups}
            onToggleField={toggleField}
          />
          {hasMore ? (
            <div aria-hidden className="h-8" ref={sentinelRef} />
          ) : (
            fieldGroups.length > INITIAL_GROUPS && (
              <p className="text-muted-foreground py-2 text-center text-xs">Alles geladen</p>
            )
          )}
        </>
      )}
    </div>
  )
}
