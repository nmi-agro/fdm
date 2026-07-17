import { format, isToday } from "date-fns"
import { nl } from "date-fns/locale"
import { ChevronRight, CircleStop, Sprout, TestTube2, Wheat } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router"
import type { TimelineField, TimelineFilters } from "~/components/blocks/timeline/gantt-view"
import { FertilizerIcon } from "@/app/components/custom/fertilizer-icon"
import {
  EVENT_TYPE_COLOR,
  getFertilizerKindColor,
} from "~/components/blocks/timeline/timeline-colors"
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
  soil_sampling: "Bodemmonster",
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
    case "fertilizer":
      return getFertilizerKindColor(event.p_type)
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
    icon = <FertilizerIcon p_type={event.p_type ?? "other"} />
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
      className="flex size-9 shrink-0 items-center justify-center rounded-md"
      style={{ backgroundColor: bg, color }}
    >
      {icon}
    </div>
  )
}

function EventCard({
  event,
  firstForFieldRef,
}: {
  event: TimelineEvent
  firstForFieldRef?: React.Ref<HTMLDivElement>
}) {
  const navigate = useNavigate()

  return (
    <div ref={firstForFieldRef}>
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <button
            className="flex w-full items-start gap-3 p-3 text-left"
            onClick={() => void navigate(event.href)}
            type="button"
          >
            <EventTypeIcon event={event} />
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {event.fieldName}
                </Badge>
                <span className="text-muted-foreground text-xs">{eventTypeLabel[event.type]}</span>
              </div>
              <p className="text-sm font-medium">{event.label}</p>
              {event.sublabel && <p className="text-muted-foreground text-sm">{event.sublabel}</p>}
            </div>
          </button>
        </CardContent>
      </Card>
    </div>
  )
}

function ActiveCultivationBar({
  cultivations,
  onSelect,
}: {
  cultivations: ReturnType<typeof getActiveCultivations>
  onSelect: (fieldId: string) => void
}) {
  if (cultivations.length === 0) return null

  return (
    <div className="bg-background sticky top-0 z-20 -mx-4 [scrollbar-width:none] overflow-x-auto px-4 py-2 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex w-max gap-2">
        {cultivations.map((cultivation) => {
          const color = getCultivationColor(cultivation.b_lu_croprotation ?? undefined)
          return (
            <button
              className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs"
              key={`${cultivation.fieldId}-${cultivation.b_lu}`}
              onClick={() => onSelect(cultivation.fieldId)}
              type="button"
            >
              <span className="inline-block size-2 rounded-sm" style={{ backgroundColor: color }} />
              <span className="text-muted-foreground">{cultivation.fieldName}:</span>
              <span className="font-medium">{cultivation.b_lu_name ?? "Onbekend"}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function DateGroupedFeed({
  groups,
  onFirstEventRef,
  stickyOffset,
}: {
  groups: ReturnType<typeof groupEventsByDate>
  onFirstEventRef: (fieldId: string, element: HTMLDivElement | null) => void
  stickyOffset: number
}) {
  const seenFields = new Set<string>()

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
              {group.events.map((event) => {
                const isFirstForField = !seenFields.has(event.fieldId)
                if (isFirstForField) seenFields.add(event.fieldId)
                return (
                  <EventCard
                    event={event}
                    key={event.id}
                    firstForFieldRef={
                      isFirstForField
                        ? (element) => onFirstEventRef(event.fieldId, element)
                        : undefined
                    }
                  />
                )
              })}
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
                  className="bg-card flex w-full items-center justify-between rounded-lg border p-3 text-left"
                  type="button"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold tracking-wide uppercase">
                        {field.b_name}
                      </span>
                      <ChevronRight
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
                              className="flex items-center gap-1.5 text-xs"
                              key={cultivation.b_lu}
                            >
                              <span
                                className="inline-block h-4 w-1 rounded-full"
                                style={{ backgroundColor: color }}
                              />
                              <span className="font-medium">
                                {cultivation.b_lu_name ?? "Onbekend"}
                              </span>
                              <span className="text-muted-foreground">({period})</span>
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
  fertilizerTypeById: Map<string, "manure" | "mineral" | "compost" | null>
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
  const fieldEventRefs = useRef(new Map<string, HTMLDivElement | null>())
  const fieldHeaderRefs = useRef(new Map<string, HTMLDivElement | null>())

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
    return [{ value: "", label: "Alle gebeurtenissen", date: today }, ...options]
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
    setVisibleGroupCount(INITIAL_GROUPS)
  }, [viewMode, monthYear, filters])

  const visibleDateGroups = dateGroups.slice(0, visibleGroupCount)
  const hasMore = visibleGroupCount < dateGroups.length

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore) {
          setVisibleGroupCount((count) => Math.min(count + GROUPS_PER_LOAD, dateGroups.length))
        }
      },
      { rootMargin: "100px" },
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, dateGroups.length])

  const activeCultivations = useMemo(() => getActiveCultivations(visibleFields), [visibleFields])

  function handleSelectCultivation(fieldId: string) {
    setViewMode("field")
    setMonthYear("")
    setExpandedFields((prev) => {
      const next = new Set(prev)
      next.add(fieldId)
      return next
    })
    setTimeout(() => {
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

  function setFirstEventRef(fieldId: string, element: HTMLDivElement | null) {
    if (element) {
      fieldEventRefs.current.set(fieldId, element)
    }
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
          <DateGroupedFeed
            groups={visibleDateGroups}
            onFirstEventRef={setFirstEventRef}
            stickyOffset={cultivationBarHeight}
          />
          {hasMore ? (
            <div aria-hidden className="h-8" ref={sentinelRef} />
          ) : (
            dateGroups.length > INITIAL_GROUPS && (
              <p className="text-muted-foreground py-2 text-center text-xs">Alles geladen</p>
            )
          )}
        </>
      ) : (
        <FieldGroupedView
          expandedFields={expandedFields}
          fieldHeaderRefs={fieldHeaderRefs}
          groups={fieldGroups}
          onToggleField={toggleField}
        />
      )}
    </div>
  )
}
