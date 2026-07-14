"use client"

import type {
  CSSProperties,
  FC,
  KeyboardEventHandler,
  MouseEventHandler,
  ReactNode,
  RefObject,
} from "react"
import { DndContext, MouseSensor, useDraggable, useSensor } from "@dnd-kit/core"
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers"
import { useMouse, useThrottle, useWindowScroll } from "@uidotdev/usehooks"
import {
  addDays,
  addMonths,
  differenceInDays,
  differenceInHours,
  differenceInMonths,
  endOfDay,
  endOfMonth,
  format,
  formatDate,
  getDate,
  getDaysInMonth,
  isSameDay,
  startOfDay,
  startOfMonth,
} from "date-fns"
import { nl } from "date-fns/locale"
import { atom, useAtom } from "jotai"
import throttle from "lodash.throttle"
import { PlusIcon, TrashIcon } from "lucide-react"
import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react"
import { Card } from "~/components/ui/card"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "~/components/ui/context-menu"
import { cn } from "~/lib/utils"

const draggingAtom = atom(false)
const scrollXAtom = atom(0)

export const useGanttDragging = () => useAtom(draggingAtom)
export const useGanttScrollX = () => useAtom(scrollXAtom)

export type GanttStatus = {
  id: string
  name: string
  color: string
}

export type GanttFeature = {
  id: string
  name: string
  startAt: Date
  endAt: Date
  status: GanttStatus
  lane?: string // Optional: features with the same lane will share a row
  /** Optional background color (e.g. an rgba string) applied to the feature's card. */
  color?: string
}

export type GanttMarkerProps = {
  id: string
  date: Date
  label: string
}

export type Range = "daily" | "monthly" | "quarterly"

export type TimelineData = {
  year: number
  quarters: {
    months: {
      days: number
    }[]
  }[]
}[]

export type GanttContextProps = {
  zoom: number
  range: Range
  columnWidth: number
  sidebarWidth: number
  headerHeight: number
  rowHeight: number
  onAddItem: ((date: Date) => void) | undefined
  placeholderLength: number
  timelineData: TimelineData
  ref: RefObject<HTMLDivElement | null> | null
  scrollToFeature?: (feature: GanttFeature) => void
}

const getsDaysIn = (range: Range) => {
  // For when range is daily
  let fn = (_date: Date) => 1

  if (range === "monthly" || range === "quarterly") {
    fn = getDaysInMonth
  }

  return fn
}

const getDifferenceIn = (range: Range) => {
  let fn = differenceInDays

  if (range === "monthly" || range === "quarterly") {
    fn = differenceInMonths
  }

  return fn
}

const getInnerDifferenceIn = (range: Range) => {
  let fn = differenceInHours

  if (range === "monthly" || range === "quarterly") {
    fn = differenceInDays
  }

  return fn
}

const getStartOf = (range: Range) => {
  let fn = startOfDay

  if (range === "monthly" || range === "quarterly") {
    fn = startOfMonth
  }

  return fn
}

const getEndOf = (range: Range) => {
  let fn = endOfDay

  if (range === "monthly" || range === "quarterly") {
    fn = endOfMonth
  }

  return fn
}

const getAddRange = (range: Range) => {
  let fn = addDays

  if (range === "monthly" || range === "quarterly") {
    fn = addMonths
  }

  return fn
}

const getDateByMousePosition = (context: GanttContextProps, mouseX: number) => {
  const timelineStartDate = new Date(context.timelineData[0].year, 0, 1)
  const columnWidth = (context.columnWidth * context.zoom) / 100
  const offset = Math.floor(mouseX / columnWidth)
  const daysIn = getsDaysIn(context.range)
  const addRange = getAddRange(context.range)
  const month = addRange(timelineStartDate, offset)
  const daysInMonth = daysIn(month)
  const pixelsPerDay = Math.round(columnWidth / daysInMonth)
  const dayOffset = Math.floor((mouseX % columnWidth) / pixelsPerDay)
  const actualDate = addDays(month, dayOffset)

  return actualDate
}

const createInitialTimelineData = (today: Date) => {
  const data: TimelineData = []

  data.push(
    { year: today.getFullYear() - 1, quarters: new Array(4).fill(null) },
    { year: today.getFullYear(), quarters: new Array(4).fill(null) },
    { year: today.getFullYear() + 1, quarters: new Array(4).fill(null) },
  )

  for (const yearObj of data) {
    yearObj.quarters = new Array(4).fill(null).map((_, quarterIndex) => ({
      months: new Array(3).fill(null).map((_, monthIndex) => {
        const month = quarterIndex * 3 + monthIndex
        return {
          days: getDaysInMonth(new Date(yearObj.year, month, 1)),
        }
      }),
    }))
  }

  return data
}

const getOffset = (date: Date, timelineStartDate: Date, context: GanttContextProps) => {
  const parsedColumnWidth = (context.columnWidth * context.zoom) / 100
  const differenceIn = getDifferenceIn(context.range)
  const startOf = getStartOf(context.range)
  const fullColumns = differenceIn(startOf(date), timelineStartDate)

  if (context.range === "daily") {
    return parsedColumnWidth * fullColumns
  }

  const partialColumns = date.getDate()
  const daysInMonth = getDaysInMonth(date)
  const pixelsPerDay = parsedColumnWidth / daysInMonth

  return fullColumns * parsedColumnWidth + partialColumns * pixelsPerDay
}

const getWidth = (startAt: Date, endAt: Date | null, context: GanttContextProps) => {
  const parsedColumnWidth = (context.columnWidth * context.zoom) / 100

  if (!endAt) {
    return parsedColumnWidth * 2
  }

  const differenceIn = getDifferenceIn(context.range)

  if (context.range === "daily") {
    const delta = differenceIn(endAt, startAt)

    return parsedColumnWidth * (delta ? delta : 1)
  }

  const daysInStartMonth = getDaysInMonth(startAt)
  const pixelsPerDayInStartMonth = parsedColumnWidth / daysInStartMonth

  if (isSameDay(startAt, endAt)) {
    return pixelsPerDayInStartMonth
  }

  const innerDifferenceIn = getInnerDifferenceIn(context.range)
  const startOf = getStartOf(context.range)

  if (isSameDay(startOf(startAt), startOf(endAt))) {
    return innerDifferenceIn(endAt, startAt) * pixelsPerDayInStartMonth
  }

  const startRangeOffset = daysInStartMonth - getDate(startAt)
  const endRangeOffset = getDate(endAt)
  const fullRangeOffset = differenceIn(startOf(endAt), startOf(startAt))
  const daysInEndMonth = getDaysInMonth(endAt)
  const pixelsPerDayInEndMonth = parsedColumnWidth / daysInEndMonth

  return (
    (fullRangeOffset - 1) * parsedColumnWidth +
    startRangeOffset * pixelsPerDayInStartMonth +
    endRangeOffset * pixelsPerDayInEndMonth
  )
}

const calculateInnerOffset = (date: Date, range: Range, columnWidth: number) => {
  const startOf = getStartOf(range)
  const endOf = getEndOf(range)
  const differenceIn = getInnerDifferenceIn(range)
  const startOfRange = startOf(date)
  const endOfRange = endOf(date)
  const totalRangeDays = differenceIn(endOfRange, startOfRange)
  const dayOfMonth = date.getDate()

  return (dayOfMonth / totalRangeDays) * columnWidth
}

export const GanttContext = createContext<GanttContextProps>({
  zoom: 100,
  range: "monthly",
  columnWidth: 50,
  headerHeight: 60,
  sidebarWidth: 300,
  rowHeight: 36,
  onAddItem: undefined,
  placeholderLength: 2,
  timelineData: [],
  ref: null,
  scrollToFeature: undefined,
})

export type GanttContentHeaderProps = {
  renderHeaderItem: (index: number) => ReactNode
  title: string
  columns: number
}

export const GanttContentHeader: FC<GanttContentHeaderProps> = ({
  title,
  columns,
  renderHeaderItem,
}) => {
  const id = useId()

  return (
    <div
      className="bg-background sticky top-0 z-20 grid w-full shrink-0"
      style={{ height: "var(--gantt-header-height)" }}
    >
      <div>
        <div
          className="text-muted-foreground sticky inline-flex px-3 py-2 text-xs whitespace-nowrap"
          style={{
            left: "var(--gantt-sidebar-width)",
          }}
        >
          <p>{title}</p>
        </div>
      </div>
      <div
        className="grid w-full"
        style={{
          gridTemplateColumns: `repeat(${columns}, var(--gantt-column-width))`,
        }}
      >
        {Array.from({ length: columns }).map((_, index) => (
          <div
            className="border-border/50 shrink-0 border-b py-1 text-center text-xs"
            key={`${id}-${index}`}
          >
            {renderHeaderItem(index)}
          </div>
        ))}
      </div>
    </div>
  )
}

const DailyHeader: FC = () => {
  const gantt = useContext(GanttContext)

  return gantt.timelineData.map((year) =>
    year.quarters
      .flatMap((quarter) => quarter.months)
      .map((month, index) => (
        <div className="relative flex flex-col" key={`${year.year}-${index}`}>
          <GanttContentHeader
            columns={month.days}
            renderHeaderItem={(item: number) => (
              <div className="flex items-center justify-center gap-1">
                <p>
                  {format(addDays(new Date(year.year, index, 1), item), "d", {
                    locale: nl,
                  })}
                </p>
                <p className="text-muted-foreground">
                  {format(addDays(new Date(year.year, index, 1), item), "EEEEE", { locale: nl })}
                </p>
              </div>
            )}
            title={format(new Date(year.year, index, 1), "MMMM yyyy", {
              locale: nl,
            })}
          />
          <GanttColumns
            columns={month.days}
            isColumnSecondary={(item: number) =>
              [0, 6].includes(addDays(new Date(year.year, index, 1), item).getDay())
            }
          />
        </div>
      )),
  )
}

const MonthlyHeader: FC = () => {
  const gantt = useContext(GanttContext)

  return gantt.timelineData.map((year) => (
    <div className="relative flex flex-col" key={year.year}>
      <GanttContentHeader
        columns={year.quarters.flatMap((quarter) => quarter.months).length}
        renderHeaderItem={(item: number) => (
          <p>{format(new Date(year.year, item, 1), "MMM", { locale: nl })}</p>
        )}
        title={`${year.year}`}
      />
      <GanttColumns columns={year.quarters.flatMap((quarter) => quarter.months).length} />
    </div>
  ))
}

const QuarterlyHeader: FC = () => {
  const gantt = useContext(GanttContext)

  return gantt.timelineData.map((year) =>
    year.quarters.map((quarter, quarterIndex) => (
      <div className="relative flex flex-col" key={`${year.year}-${quarterIndex}`}>
        <GanttContentHeader
          columns={quarter.months.length}
          renderHeaderItem={(item: number) => (
            <p>
              {format(new Date(year.year, quarterIndex * 3 + item, 1), "MMM", {
                locale: nl,
              })}
            </p>
          )}
          title={`K${quarterIndex + 1} ${year.year}`}
        />
        <GanttColumns columns={quarter.months.length} />
      </div>
    )),
  )
}

const headers: Record<Range, FC> = {
  daily: DailyHeader,
  monthly: MonthlyHeader,
  quarterly: QuarterlyHeader,
}

export type GanttHeaderProps = {
  className?: string
}

export const GanttHeader: FC<GanttHeaderProps> = ({ className }) => {
  const gantt = useContext(GanttContext)
  const Header = headers[gantt.range]

  return (
    <div className={cn("divide-border/50 flex h-full w-max -space-x-px divide-x", className)}>
      <Header />
    </div>
  )
}

export type GanttSidebarItemProps = {
  feature: GanttFeature
  onSelectItem?: (id: string) => void
  className?: string
}

export const GanttSidebarItem: FC<GanttSidebarItemProps> = ({
  feature,
  onSelectItem,
  className,
}) => {
  const gantt = useContext(GanttContext)

  const handleClick: MouseEventHandler<HTMLDivElement> = (event) => {
    if (event.target === event.currentTarget) {
      // Scroll to the feature in the timeline
      gantt.scrollToFeature?.(feature)
      // Call the original onSelectItem callback
      onSelectItem?.(feature.id)
    }
  }

  const handleKeyDown: KeyboardEventHandler<HTMLDivElement> = (event) => {
    if (event.key === "Enter") {
      // Scroll to the feature in the timeline
      gantt.scrollToFeature?.(feature)
      // Call the original onSelectItem callback
      onSelectItem?.(feature.id)
    }
  }

  return (
    <div
      className={cn(
        "hover:bg-secondary relative flex items-center gap-2.5 p-2.5 text-xs",
        className,
      )}
      key={feature.id}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      // biome-ignore lint/a11y/useSemanticElements: "This is a clickable item"
      role="button"
      style={{
        height: "var(--gantt-row-height)",
      }}
      tabIndex={0}
    >
      {/* <Checkbox onCheckedChange={handleCheck} className="shrink-0" /> */}
      <div
        className="pointer-events-none h-2 w-2 shrink-0 rounded-full"
        style={{
          backgroundColor: feature.status.color,
        }}
      />
      <p className="pointer-events-none flex-1 truncate text-left font-medium">{feature.name}</p>
    </div>
  )
}

export const GanttSidebarHeader: FC = () => (
  <div
    className="border-border/50 bg-background text-muted-foreground sticky top-0 z-10 flex shrink-0 items-end justify-between gap-2.5 border-b p-2.5 text-xs font-medium"
    style={{ height: "var(--gantt-header-height)" }}
  >
    {/* <Checkbox className="shrink-0" /> */}
    <p className="flex-1 truncate text-left">Percelen</p>
  </div>
)

export type GanttSidebarGroupProps = {
  children: ReactNode
  name: string
  className?: string
}

export const GanttSidebarGroup: FC<GanttSidebarGroupProps> = ({ children, name, className }) => (
  <div className={className}>
    <p
      className="text-muted-foreground w-full truncate p-2.5 text-left text-xs font-medium"
      style={{ height: "var(--gantt-row-height)" }}
    >
      {name}
    </p>
    <div className="divide-border/50 divide-y">{children}</div>
  </div>
)

export type GanttSidebarProps = {
  children: ReactNode
  className?: string
}

export const GanttSidebar: FC<GanttSidebarProps> = ({ children, className }) => (
  <div
    className={cn(
      "border-border/50 bg-background sticky left-0 z-30 h-max min-h-full overflow-clip border-r",
      className,
    )}
    data-roadmap-ui="gantt-sidebar"
  >
    <GanttSidebarHeader />
    <div className="space-y-4">{children}</div>
  </div>
)

export type GanttAddFeatureHelperProps = {
  top: number
  className?: string
}

export const GanttAddFeatureHelper: FC<GanttAddFeatureHelperProps> = ({ top, className }) => {
  const [scrollX] = useGanttScrollX()
  const gantt = useContext(GanttContext)
  const [mousePosition, mouseRef] = useMouse<HTMLDivElement>()

  const handleClick = () => {
    const ganttRect = gantt.ref?.current?.getBoundingClientRect()
    const x = mousePosition.x - (ganttRect?.left ?? 0) + scrollX - gantt.sidebarWidth
    const currentDate = getDateByMousePosition(gantt, x)

    gantt.onAddItem?.(currentDate)
  }

  return (
    <div
      className={cn("absolute top-0 w-full px-0.5", className)}
      ref={mouseRef}
      style={{
        marginTop: -gantt.rowHeight / 2,
        transform: `translateY(${top}px)`,
      }}
    >
      <button
        className="flex h-full w-full items-center justify-center rounded-md border border-dashed p-2"
        onClick={handleClick}
        type="button"
      >
        <PlusIcon className="text-muted-foreground pointer-events-none select-none" size={16} />
      </button>
    </div>
  )
}

export type GanttColumnProps = {
  index: number
  isColumnSecondary?: (item: number) => boolean
}

export const GanttColumn: FC<GanttColumnProps> = ({ index, isColumnSecondary }) => {
  const gantt = useContext(GanttContext)
  const [dragging] = useGanttDragging()
  const [mousePosition, mouseRef] = useMouse<HTMLDivElement>()
  const [hovering, setHovering] = useState(false)
  const [windowScroll] = useWindowScroll()

  const handleMouseEnter = () => setHovering(true)
  const handleMouseLeave = () => setHovering(false)

  const top = useThrottle(
    mousePosition.y - (mouseRef.current?.getBoundingClientRect().y ?? 0) - (windowScroll.y ?? 0),
    10,
  )

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: "This is a clickable column"
    // biome-ignore lint/nursery/noNoninteractiveElementInteractions: "This is a clickable column"
    <div
      className={cn(
        "group relative h-full overflow-hidden",
        isColumnSecondary?.(index) ? "bg-secondary" : "",
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      ref={mouseRef}
    >
      {!dragging && hovering && gantt.onAddItem ? <GanttAddFeatureHelper top={top} /> : null}
    </div>
  )
}

export type GanttColumnsProps = {
  columns: number
  isColumnSecondary?: (item: number) => boolean
}

export const GanttColumns: FC<GanttColumnsProps> = ({ columns, isColumnSecondary }) => {
  const id = useId()

  return (
    <div
      className="divide divide-border/50 grid h-full w-full divide-x"
      style={{
        gridTemplateColumns: `repeat(${columns}, var(--gantt-column-width))`,
      }}
    >
      {Array.from({ length: columns }).map((_, index) => (
        <GanttColumn index={index} isColumnSecondary={isColumnSecondary} key={`${id}-${index}`} />
      ))}
    </div>
  )
}

export type GanttCreateMarkerTriggerProps = {
  onCreateMarker: (date: Date) => void
  className?: string
}

export const GanttCreateMarkerTrigger: FC<GanttCreateMarkerTriggerProps> = ({
  onCreateMarker,
  className,
}) => {
  const gantt = useContext(GanttContext)
  const [mousePosition, mouseRef] = useMouse<HTMLDivElement>()
  const [windowScroll] = useWindowScroll()
  const x = useThrottle(
    mousePosition.x - (mouseRef.current?.getBoundingClientRect().x ?? 0) - (windowScroll.x ?? 0),
    10,
  )

  const date = getDateByMousePosition(gantt, x)

  const handleClick = () => onCreateMarker(date)

  return (
    <div
      className={cn(
        "group pointer-events-none absolute top-0 left-0 h-full w-full overflow-visible select-none",
        className,
      )}
      ref={mouseRef}
    >
      <div
        className="pointer-events-auto sticky top-6 z-20 -ml-2 flex w-4 flex-col items-center justify-center gap-1 overflow-visible opacity-0 group-hover:opacity-100"
        style={{ transform: `translateX(${x}px)` }}
      >
        <button
          className="bg-card z-50 inline-flex h-4 w-4 items-center justify-center rounded-full"
          onClick={handleClick}
          type="button"
        >
          <PlusIcon className="text-muted-foreground" size={12} />
        </button>
        <div className="border-border/50 bg-background/90 text-foreground rounded-full border px-2 py-1 text-xs whitespace-nowrap backdrop-blur-lg">
          {formatDate(date, "d MMM yyyy", { locale: nl })}
        </div>
      </div>
    </div>
  )
}

export type GanttFeatureDragHelperProps = {
  featureId: GanttFeature["id"]
  direction: "left" | "right"
  date: Date | null
}

export const GanttFeatureDragHelper: FC<GanttFeatureDragHelperProps> = ({
  direction,
  featureId,
  date,
}) => {
  const [, setDragging] = useGanttDragging()
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `feature-drag-helper-${featureId}`,
  })

  const isPressed = Boolean(attributes["aria-pressed"])

  useEffect(() => setDragging(isPressed), [isPressed, setDragging])

  return (
    <div
      className={cn(
        "group absolute top-1/2 z-[3] h-full w-6 -translate-y-1/2 !cursor-col-resize rounded-md outline-none",
        direction === "left" ? "-left-2.5" : "-right-2.5",
      )}
      ref={setNodeRef}
      {...attributes}
      {...listeners}
    >
      <div
        className={cn(
          "bg-muted-foreground absolute top-1/2 h-[80%] w-1 -translate-y-1/2 rounded-sm opacity-0 transition-all",
          direction === "left" ? "left-2.5" : "right-2.5",
          direction === "left" ? "group-hover:left-0" : "group-hover:right-0",
          isPressed && (direction === "left" ? "left-0" : "right-0"),
          "group-hover:opacity-100",
          isPressed && "opacity-100",
        )}
      />
      {date && (
        <div
          className={cn(
            "border-border/50 bg-background/90 text-foreground absolute top-10 hidden -translate-x-1/2 rounded-lg border px-2 py-1 text-xs whitespace-nowrap backdrop-blur-lg group-hover:block",
            isPressed && "block",
          )}
        >
          {format(date, "d MMM yyyy", { locale: nl })}
        </div>
      )}
    </div>
  )
}

export type GanttFeatureItemCardProps = Pick<GanttFeature, "id" | "color"> & {
  children?: ReactNode
}

export const GanttFeatureItemCard: FC<GanttFeatureItemCardProps> = ({ id, color, children }) => {
  const [, setDragging] = useGanttDragging()
  const { attributes, listeners, setNodeRef } = useDraggable({ id })
  const isPressed = Boolean(attributes["aria-pressed"])

  useEffect(() => setDragging(isPressed), [isPressed, setDragging])

  return (
    <Card
      className="bg-background h-full w-full rounded-md p-2 text-xs shadow-sm"
      style={color ? { backgroundColor: color } : undefined}
    >
      <div
        className={cn(
          "flex h-full w-full items-center justify-between gap-2 text-left",
          isPressed && "cursor-grabbing",
        )}
        {...attributes}
        {...listeners}
        ref={setNodeRef}
      >
        {children}
      </div>
    </Card>
  )
}

export type GanttFeatureItemProps = GanttFeature & {
  onMove?: (id: string, startDate: Date, endDate: Date | null) => void
  children?: ReactNode
  className?: string
}

export const GanttFeatureItem: FC<GanttFeatureItemProps> = ({
  onMove,
  children,
  className,
  ...feature
}) => {
  const [scrollX] = useGanttScrollX()
  const gantt = useContext(GanttContext)
  const timelineStartDate = useMemo(
    () => new Date(gantt.timelineData.at(0)?.year ?? 0, 0, 1),
    [gantt.timelineData],
  )
  const [startAt, setStartAt] = useState<Date>(feature.startAt)
  const [endAt, setEndAt] = useState<Date | null>(feature.endAt)

  // Memoize expensive calculations
  const width = useMemo(() => getWidth(startAt, endAt, gantt), [startAt, endAt, gantt])
  const offset = useMemo(
    () => getOffset(startAt, timelineStartDate, gantt),
    [startAt, timelineStartDate, gantt],
  )

  const addRange = useMemo(() => getAddRange(gantt.range), [gantt.range])
  const [mousePosition] = useMouse<HTMLDivElement>()

  const [previousMouseX, setPreviousMouseX] = useState(0)
  const [previousStartAt, setPreviousStartAt] = useState(startAt)
  const [previousEndAt, setPreviousEndAt] = useState(endAt)

  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: {
      distance: 10,
    },
  })

  const handleItemDragStart = useCallback(() => {
    setPreviousMouseX(mousePosition.x)
    setPreviousStartAt(startAt)
    setPreviousEndAt(endAt)
  }, [mousePosition.x, startAt, endAt])

  const handleItemDragMove = useCallback(() => {
    const currentDate = getDateByMousePosition(gantt, mousePosition.x)
    const originalDate = getDateByMousePosition(gantt, previousMouseX)
    const delta =
      gantt.range === "daily"
        ? getDifferenceIn(gantt.range)(currentDate, originalDate)
        : getInnerDifferenceIn(gantt.range)(currentDate, originalDate)
    const newStartDate = addDays(previousStartAt, delta)
    const newEndDate = previousEndAt ? addDays(previousEndAt, delta) : null

    setStartAt(newStartDate)
    setEndAt(newEndDate)
  }, [gantt, mousePosition.x, previousMouseX, previousStartAt, previousEndAt])

  const onDragEnd = useCallback(
    () => onMove?.(feature.id, startAt, endAt),
    [onMove, feature.id, startAt, endAt],
  )

  const handleLeftDragMove = useCallback(() => {
    const ganttRect = gantt.ref?.current?.getBoundingClientRect()
    const x = mousePosition.x - (ganttRect?.left ?? 0) + scrollX - gantt.sidebarWidth
    const newStartAt = getDateByMousePosition(gantt, x)

    setStartAt(newStartAt)
  }, [gantt, mousePosition.x, scrollX])

  const handleRightDragMove = useCallback(() => {
    const ganttRect = gantt.ref?.current?.getBoundingClientRect()
    const x = mousePosition.x - (ganttRect?.left ?? 0) + scrollX - gantt.sidebarWidth
    const newEndAt = getDateByMousePosition(gantt, x)

    setEndAt(newEndAt)
  }, [gantt, mousePosition.x, scrollX])

  return (
    <div
      className={cn("relative flex w-max min-w-full py-0.5", className)}
      style={{ height: "var(--gantt-row-height)" }}
    >
      <div
        className="pointer-events-auto absolute top-0.5"
        style={{
          height: "calc(var(--gantt-row-height) - 4px)",
          width: Math.round(width),
          left: Math.round(offset),
        }}
      >
        {onMove && (
          <DndContext
            modifiers={[restrictToHorizontalAxis]}
            onDragEnd={onDragEnd}
            onDragMove={handleLeftDragMove}
            sensors={[mouseSensor]}
          >
            <GanttFeatureDragHelper date={startAt} direction="left" featureId={feature.id} />
          </DndContext>
        )}
        <DndContext
          modifiers={[restrictToHorizontalAxis]}
          onDragEnd={onDragEnd}
          onDragMove={handleItemDragMove}
          onDragStart={handleItemDragStart}
          sensors={[mouseSensor]}
        >
          <GanttFeatureItemCard color={feature.color} id={feature.id}>
            {children ?? <p className="flex-1 truncate text-xs">{feature.name}</p>}
          </GanttFeatureItemCard>
        </DndContext>
        {onMove && (
          <DndContext
            modifiers={[restrictToHorizontalAxis]}
            onDragEnd={onDragEnd}
            onDragMove={handleRightDragMove}
            sensors={[mouseSensor]}
          >
            <GanttFeatureDragHelper
              date={endAt ?? addRange(startAt, 2)}
              direction="right"
              featureId={feature.id}
            />
          </DndContext>
        )}
      </div>
    </div>
  )
}

export type GanttFeatureListGroupProps = {
  children: ReactNode
  className?: string
}

export const GanttFeatureListGroup: FC<GanttFeatureListGroupProps> = ({ children, className }) => (
  <div className={className} style={{ paddingTop: "var(--gantt-row-height)" }}>
    {children}
  </div>
)

export type GanttFeatureRowProps = {
  features: GanttFeature[]
  onMove?: (id: string, startAt: Date, endAt: Date | null) => void
  children?: (feature: GanttFeature) => ReactNode
  className?: string
}

export const GanttFeatureRow: FC<GanttFeatureRowProps> = ({
  features,
  onMove,
  children,
  className,
}) => {
  // Sort features by start date to handle potential overlaps
  const sortedFeatures = [...features].sort((a, b) => a.startAt.getTime() - b.startAt.getTime())

  // Calculate sub-row positions for overlapping features using a proper algorithm
  const featureWithPositions = []
  const subRowEndTimes: Date[] = [] // Track when each sub-row becomes free

  for (const feature of sortedFeatures) {
    let subRow = 0

    // Find the first sub-row that's free (doesn't overlap)
    while (subRow < subRowEndTimes.length && subRowEndTimes[subRow] > feature.startAt) {
      subRow++
    }

    // Update the end time for this sub-row
    if (subRow === subRowEndTimes.length) {
      subRowEndTimes.push(feature.endAt)
    } else {
      subRowEndTimes[subRow] = feature.endAt
    }

    featureWithPositions.push({ ...feature, subRow })
  }

  const maxSubRows = Math.max(1, subRowEndTimes.length)
  const subRowHeight = 36 // Base row height

  return (
    <div
      className={cn("relative", className)}
      style={{
        height: `${maxSubRows * subRowHeight}px`,
        minHeight: "var(--gantt-row-height)",
      }}
    >
      {featureWithPositions.map((feature) => (
        <div
          className="absolute w-full"
          key={feature.id}
          style={{
            top: `${feature.subRow * subRowHeight}px`,
            height: `${subRowHeight}px`,
          }}
        >
          <GanttFeatureItem {...feature} onMove={onMove}>
            {children ? (
              children(feature)
            ) : (
              <p className="flex-1 truncate text-xs">{feature.name}</p>
            )}
          </GanttFeatureItem>
        </div>
      ))}
    </div>
  )
}

export type GanttFeatureListProps = {
  className?: string
  children: ReactNode
}

export const GanttFeatureList: FC<GanttFeatureListProps> = ({ className, children }) => (
  <div
    className={cn("absolute top-0 left-0 h-full w-max space-y-4", className)}
    style={{ marginTop: "var(--gantt-header-height)" }}
  >
    {children}
  </div>
)

export const GanttMarker: FC<
  GanttMarkerProps & {
    onRemove?: (id: string) => void
    className?: string
  }
> = memo(({ label, date, id, onRemove, className }) => {
  const gantt = useContext(GanttContext)
  const differenceIn = useMemo(() => getDifferenceIn(gantt.range), [gantt.range])
  const timelineStartDate = useMemo(
    () => new Date(gantt.timelineData.at(0)?.year ?? 0, 0, 1),
    [gantt.timelineData],
  )

  // Memoize expensive calculations
  const offset = useMemo(
    () => differenceIn(date, timelineStartDate),
    [differenceIn, date, timelineStartDate],
  )
  const innerOffset = useMemo(
    () => calculateInnerOffset(date, gantt.range, (gantt.columnWidth * gantt.zoom) / 100),
    [date, gantt.range, gantt.columnWidth, gantt.zoom],
  )

  const handleRemove = useCallback(() => onRemove?.(id), [onRemove, id])

  return (
    <div
      className="pointer-events-none absolute top-0 left-0 z-20 flex h-full flex-col items-center justify-center overflow-visible select-none"
      style={{
        width: 0,
        transform: `translateX(calc(var(--gantt-column-width) * ${offset} + ${innerOffset}px))`,
      }}
    >
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className={cn(
              "group bg-card text-foreground pointer-events-auto sticky top-0 flex flex-col flex-nowrap items-center justify-center rounded-b-md px-2 py-1 text-xs whitespace-nowrap select-auto",
              className,
            )}
          >
            {label}
            <span className="max-h-[0] overflow-hidden opacity-80 transition-all group-hover:max-h-[2rem]">
              {formatDate(date, "d MMM yyyy", { locale: nl })}
            </span>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          {onRemove ? (
            <ContextMenuItem
              className="text-destructive flex items-center gap-2"
              onClick={handleRemove}
            >
              <TrashIcon size={16} />
              Marker verwijderen
            </ContextMenuItem>
          ) : null}
        </ContextMenuContent>
      </ContextMenu>
      <div className={cn("bg-card h-full w-px", className)} />
    </div>
  )
})

GanttMarker.displayName = "GanttMarker"

export type GanttProviderProps = {
  range?: Range
  zoom?: number
  onAddItem?: (date: Date) => void
  children: ReactNode
  className?: string
}

export const GanttProvider: FC<GanttProviderProps> = ({
  zoom = 100,
  range = "monthly",
  onAddItem,
  children,
  className,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [timelineData, setTimelineData] = useState<TimelineData>(
    createInitialTimelineData(new Date()),
  )
  const [, setScrollX] = useGanttScrollX()
  const [sidebarWidth, setSidebarWidth] = useState(0)

  const headerHeight = 60
  const rowHeight = 36
  let columnWidth = 50

  if (range === "monthly") {
    columnWidth = 150
  } else if (range === "quarterly") {
    columnWidth = 100
  }

  // Memoize CSS variables to prevent unnecessary re-renders
  const cssVariables = useMemo(
    () =>
      ({
        "--gantt-zoom": `${zoom}`,
        "--gantt-column-width": `${(zoom / 100) * columnWidth}px`,
        "--gantt-header-height": `${headerHeight}px`,
        "--gantt-row-height": `${rowHeight}px`,
        "--gantt-sidebar-width": `${sidebarWidth}px`,
      }) as CSSProperties,
    [zoom, columnWidth, sidebarWidth],
  )

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft =
        scrollRef.current.scrollWidth / 2 - scrollRef.current.clientWidth / 2
      setScrollX(scrollRef.current.scrollLeft)
    }
  }, [setScrollX])

  // Update sidebar width when DOM is ready
  useEffect(() => {
    const updateSidebarWidth = () => {
      const sidebarElement = scrollRef.current?.querySelector('[data-roadmap-ui="gantt-sidebar"]')
      const newWidth = sidebarElement ? 300 : 0
      setSidebarWidth(newWidth)
    }

    // Update immediately
    updateSidebarWidth()

    // Also update on resize or when children change
    const observer = new MutationObserver(updateSidebarWidth)
    if (scrollRef.current) {
      observer.observe(scrollRef.current, {
        childList: true,
        subtree: true,
      })
    }

    return () => {
      observer.disconnect()
    }
  }, [])

  // Fix the useCallback to include all dependencies
  const handleScroll = useCallback(
    throttle(() => {
      const scrollElement = scrollRef.current
      if (!scrollElement) {
        return
      }

      const { scrollLeft, scrollWidth, clientWidth } = scrollElement
      setScrollX(scrollLeft)

      if (scrollLeft === 0) {
        // Extend timelineData to the past
        const firstYear = timelineData[0]?.year

        if (!firstYear) {
          return
        }

        const newTimelineData: TimelineData = [...timelineData]
        newTimelineData.unshift({
          year: firstYear - 1,
          quarters: new Array(4).fill(null).map((_, quarterIndex) => ({
            months: new Array(3).fill(null).map((_, monthIndex) => {
              const month = quarterIndex * 3 + monthIndex
              return {
                days: getDaysInMonth(new Date(firstYear, month, 1)),
              }
            }),
          })),
        })

        setTimelineData(newTimelineData)

        // Scroll a bit forward so it's not at the very start
        scrollElement.scrollLeft = scrollElement.clientWidth
        setScrollX(scrollElement.scrollLeft)
      } else if (scrollLeft + clientWidth >= scrollWidth) {
        // Extend timelineData to the future
        const lastYear = timelineData.at(-1)?.year

        if (!lastYear) {
          return
        }

        const newTimelineData: TimelineData = [...timelineData]
        newTimelineData.push({
          year: lastYear + 1,
          quarters: new Array(4).fill(null).map((_, quarterIndex) => ({
            months: new Array(3).fill(null).map((_, monthIndex) => {
              const month = quarterIndex * 3 + monthIndex
              return {
                days: getDaysInMonth(new Date(lastYear, month, 1)),
              }
            }),
          })),
        })

        setTimelineData(newTimelineData)

        // Scroll a bit back so it's not at the very end
        scrollElement.scrollLeft = scrollElement.scrollWidth - scrollElement.clientWidth
        setScrollX(scrollElement.scrollLeft)
      }
    }, 100),
    [],
  )

  useEffect(() => {
    const scrollElement = scrollRef.current
    if (scrollElement) {
      scrollElement.addEventListener("scroll", handleScroll)
    }

    return () => {
      // Fix memory leak by properly referencing the scroll element
      if (scrollElement) {
        scrollElement.removeEventListener("scroll", handleScroll)
      }
    }
  }, [handleScroll])

  const scrollToFeature = useCallback(
    (feature: GanttFeature) => {
      const scrollElement = scrollRef.current
      if (!scrollElement) {
        return
      }

      // Calculate timeline start date from timelineData
      const timelineStartDate = new Date(timelineData[0].year, 0, 1)

      // Calculate the horizontal offset for the feature's start date
      const offset = getOffset(feature.startAt, timelineStartDate, {
        zoom,
        range,
        columnWidth,
        sidebarWidth,
        headerHeight,
        rowHeight,
        onAddItem,
        placeholderLength: 2,
        timelineData,
        ref: scrollRef,
      })

      // Scroll to align the feature's start with the right side of the sidebar
      const targetScrollLeft = Math.max(0, offset)

      scrollElement.scrollTo({
        left: targetScrollLeft,
        behavior: "smooth",
      })
    },
    [timelineData, zoom, range, columnWidth, sidebarWidth, onAddItem],
  )

  return (
    <GanttContext.Provider
      value={{
        zoom,
        range,
        headerHeight,
        columnWidth,
        sidebarWidth,
        rowHeight,
        onAddItem,
        timelineData,
        placeholderLength: 2,
        ref: scrollRef,
        scrollToFeature,
      }}
    >
      <div
        className={cn(
          "gantt bg-secondary relative isolate grid h-full w-full flex-none overflow-auto rounded-sm select-none",
          range,
          className,
        )}
        ref={scrollRef}
        style={{
          ...cssVariables,
          gridTemplateColumns: "var(--gantt-sidebar-width) 1fr",
        }}
      >
        {children}
      </div>
    </GanttContext.Provider>
  )
}

export type GanttTimelineProps = {
  children: ReactNode
  className?: string
  style?: CSSProperties
}

export const GanttTimeline: FC<GanttTimelineProps> = ({ children, className, style }) => (
  <div className={cn("relative flex h-full w-max flex-none overflow-clip", className)} style={style}>
    {children}
  </div>
)

export type GanttTodayProps = {
  className?: string
}

export const GanttToday: FC<GanttTodayProps> = ({ className }) => {
  const label = "Vandaag"
  const date = useMemo(() => new Date(), [])
  const gantt = useContext(GanttContext)
  const differenceIn = useMemo(() => getDifferenceIn(gantt.range), [gantt.range])
  const timelineStartDate = useMemo(
    () => new Date(gantt.timelineData.at(0)?.year ?? 0, 0, 1),
    [gantt.timelineData],
  )

  // Memoize expensive calculations
  const offset = useMemo(
    () => differenceIn(date, timelineStartDate),
    [differenceIn, date, timelineStartDate],
  )
  const innerOffset = useMemo(
    () => calculateInnerOffset(date, gantt.range, (gantt.columnWidth * gantt.zoom) / 100),
    [date, gantt.range, gantt.columnWidth, gantt.zoom],
  )

  return (
    <div
      className="pointer-events-none absolute top-0 left-0 z-20 flex h-full flex-col items-center justify-center overflow-visible select-none"
      style={{
        width: 0,
        transform: `translateX(calc(var(--gantt-column-width) * ${offset} + ${innerOffset}px))`,
      }}
    >
      <div
        className={cn(
          "group bg-card text-foreground pointer-events-auto sticky top-0 flex flex-col flex-nowrap items-center justify-center rounded-b-md px-2 py-1 text-xs whitespace-nowrap select-auto",
          className,
        )}
      >
        {label}
        <span className="max-h-[0] overflow-hidden opacity-80 transition-all group-hover:max-h-[2rem]">
          {formatDate(date, "d MMM yyyy", { locale: nl })}
        </span>
      </div>
      <div className={cn("bg-card h-full w-px", className)} />
    </div>
  )
}
