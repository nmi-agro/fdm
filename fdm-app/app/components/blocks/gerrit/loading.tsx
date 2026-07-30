import {
  AlertTriangle,
  BookOpenText,
  Bot,
  Calculator,
  Check,
  Search,
  Landmark,
  Shapes,
  Sparkles,
  Sprout,
  ChevronUp,
  ChevronDown,
} from "lucide-react"
import {
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible"
import { Marker, MarkerContent, MarkerIcon } from "~/components/ui/marker"
import { Spinner } from "~/components/ui/spinner"
import { cn } from "~/lib/utils"

interface StreamEvent {
  type: string
  data: any
}

// Tool name → Dutch label (replaces the PHASES array for label lookup only)
export const TOOL_LABELS: Record<string, { name: string; icon: typeof Check }> = {
  getFarmFields: { name: "Gegevens verzamelen", icon: Search },
  getCropFertilizerGuide: { name: "Teelthandleiding raadplegen", icon: Sprout },
  getFarmNutrientAdvice: { name: "Bemestingsadvies ophalen", icon: BookOpenText },
  getFarmLegalNorms: { name: "Gebruiksruimte berekenen", icon: Landmark },
  searchFertilizers: { name: "Meststoffen zoeken", icon: Shapes },
  simulateFarmPlan: { name: "Bemestingsplan doorrekenen", icon: Calculator },
}

type TimelineEntry =
  | { kind: "status"; id: string; label: string }
  | { kind: "error"; id: string; message: string }
  | {
      kind: "tool"
      id: string
      toolName: string
      label: (typeof TOOL_LABELS)[string]
      status: "running" | "done"
      count: number
    }
  | { kind: "reasoning"; id: string; text: string; isActive: boolean; isMultiLine: boolean }

/**
 * Converts the current stream events into timeline entries. Most importantly, it merges tool_start events
 * that are for the same tool, and handles tool_end events as the completion of an existing timeline tool
 * entry.
 *
 * @param events Events to convert.
 * @returns Array of timeline entries that should be rendered as markers.
 */
function deriveTimeline(events: StreamEvent[]): TimelineEntry[] {
  const entries: TimelineEntry[] = []
  // Track insertion order for tools and the current reasoning entry
  const toolIndex = new Map<string, number>() // toolName → index in entries
  let reasoningIndex = -1
  let toolsDoneUpTo = 0

  for (const event of events) {
    if (!event || typeof event !== "object") continue

    if (event.type === "error") {
      const message =
        typeof event.data === "string"
          ? event.data
          : (event.data?.message ??
            event.data?.error ??
            "Er is een fout opgetreden bij de verwerking.")
      entries.push({ kind: "error", id: `err-${entries.length}`, message })
    } else if (event.type === "start" || event.type === "status") {
      const label = event.data?.message
      if (label) {
        entries.push({ kind: "status", id: `sep-${entries.length}`, label })
      }
    } else if (event.type === "on_tool_start") {
      const name = event.data?.name
      if (!name) continue
      // Mark reasoning inactive once any tool fires after it
      if (reasoningIndex !== -1) {
        ;(entries[reasoningIndex] as Extract<TimelineEntry, { kind: "reasoning" }>).isActive = false
      }
      const existing = toolIndex.get(name)
      if (existing !== undefined) {
        // Tool fired again — increment counter, reset to running
        const entry = entries[existing] as Extract<TimelineEntry, { kind: "tool" }>
        entry.count += 1
        entry.status = "running"
      } else {
        toolIndex.set(name, entries.length)
        entries.push({
          kind: "tool",
          id: `tool-${name}-${entries.length}`,
          toolName: name,
          label: TOOL_LABELS[name] ?? { name: "Onbekend", icon: Calculator },
          status: "running",
          count: 1,
        })
      }
    } else if (event.type === "on_tool_end") {
      const name = event.data?.name
      if (!name) continue
      const idx = toolIndex.get(name)
      if (idx !== undefined) {
        ;(entries[idx] as Extract<TimelineEntry, { kind: "tool" }>).status = "done"
      }
    } else if (event.type === "reasoning") {
      const chunk: string = event.data?.chunk ?? ""
      if (!chunk) continue

      if (
        reasoningIndex === -1 ||
        entries[reasoningIndex].kind !== "reasoning" ||
        toolIndex.size > 0
      ) {
        reasoningIndex = entries.length
        entries.push({
          kind: "reasoning",
          id: `reasoning-${entries.length}`,
          text: chunk.trimStart(),
          isActive: true,
          isMultiLine: chunk.includes("\n"),
        })
      } else {
        const entry = entries[reasoningIndex]
        if (entry.kind === "reasoning") {
          entry.text += chunk
        }
      }

      // We assume that all the tool calls have ended when the agent starts reasoning.
      while (toolsDoneUpTo < entries.length) {
        const entry = entries[toolsDoneUpTo]
        if (entry.kind === "tool") {
          entry.status = "done"
        }
        toolsDoneUpTo++
      }
    }
  }

  for (const entry of entries) {
    if (entry.kind === "reasoning") {
      entry.text = entry.text.replaceAll("\n\n\n\n\n", "\n\n\n").replaceAll("\n\n\n\n", "\n\n\n")
    }
  }

  return entries
}

const AUTO_SCROLL_THRESHOLD = 100 // px from bottom of reasoning feed to trigger auto-scroll

export function GerritLoading({
  events = [],
  title = "Gerrit is aan het werk…",
  initialMessage,
}: {
  events?: StreamEvent[]
  title?: string
  initialMessage?: string
}) {
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef(Date.now())
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const id = setInterval(
      () => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)),
      1000,
    )
    return () => clearInterval(id)
  }, [])

  const timeline = useMemo(() => deriveTimeline(events), [events])

  const totalReasoningLength = useMemo(
    () =>
      timeline.reduce(
        (acc, entry) => acc + (entry.kind === "reasoning" ? entry.text.length : 0),
        0,
      ),
    [timeline],
  )

  // Auto-scroll the reasoning feed when it's open and growing.
  useEffect(() => {
    if (
      bottomRef.current &&
      scrollRef.current &&
      scrollRef.current.getBoundingClientRect().bottom + AUTO_SCROLL_THRESHOLD >
        bottomRef.current.getBoundingClientRect().top
    ) {
      scrollRef.current.scrollTo({
        behavior: "smooth",
        top: scrollRef.current.scrollHeight,
      })
    }
  }, [timeline.length, totalReasoningLength])

  const handleScroll = useCallback(() => {
    const scrollElement = scrollRef.current
    const scrollContainerElement = scrollContainerRef.current
    if (!scrollElement || !scrollContainerElement) return
    if (scrollElement.scrollTop > 5) {
      scrollContainerElement.dataset.scrollStart = ""
    } else {
      delete scrollContainerElement.dataset.scrollStart
    }

    if (scrollElement.scrollHeight - scrollElement.scrollTop > 5 + scrollElement.offsetHeight) {
      scrollContainerElement.dataset.scrollEnd = ""
    } else {
      delete scrollContainerElement.dataset.scrollEnd
    }
  }, [])

  useLayoutEffect(() => {
    handleScroll()
  }, [handleScroll])

  const elapsedStr = elapsed >= 60 ? `${Math.floor(elapsed / 60)}m ${elapsed % 60}s` : `${elapsed}s`

  return (
    <Card className="flex flex-col shadow-sm">
      <CardHeader className="shrink-0 border-b">
        <CardTitle className="flex items-center justify-between text-base font-semibold">
          <span className="flex items-center gap-2">
            <Bot className="text-primary h-5 w-5 animate-pulse motion-reduce:animate-none" />
            {title}
          </span>
          <span className="text-muted-foreground text-sm font-normal tabular-nums">
            {elapsedStr}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent ref={scrollContainerRef} className="group relative p-0">
        <Button
          type="button"
          variant="outline"
          aria-label="Scrol naar boven"
          className="bg-background/80 pointer-events-none absolute top-1 left-1/2 h-auto -translate-x-1/2 opacity-0 shadow-xs backdrop-blur-xs transition-opacity duration-200 group-data-scroll-start:pointer-events-auto group-data-scroll-start:opacity-100"
          onClick={() =>
            scrollRef.current?.scrollTo({
              top: 0,
              behavior: "smooth",
            })
          }
        >
          <ChevronUp className="text-muted-foreground my-1 h-4 w-4" />
        </Button>
        <div
          ref={scrollRef}
          className="max-h-full overflow-y-auto"
          onScroll={handleScroll}
          aria-live="polite"
        >
          <div className="text-muted-foreground space-y-6 p-6 text-sm">
            {timeline.length === 0 && (
              <Marker role="status">
                <MarkerIcon>
                  <Spinner />
                </MarkerIcon>
                <MarkerContent>{initialMessage ?? "Voorbereiden…"}</MarkerContent>
              </Marker>
            )}

            {timeline.map((entry) => {
              if (entry.kind === "error") {
                return (
                  <Marker key={entry.id} role="alert">
                    <MarkerIcon>
                      <AlertTriangle className="text-destructive h-4 w-4 shrink-0" />
                    </MarkerIcon>
                    <MarkerContent className="text-destructive font-medium">
                      {entry.message}
                    </MarkerContent>
                  </Marker>
                )
              }

              if (entry.kind === "status") {
                return (
                  <Marker key={entry.id}>
                    <MarkerContent className="text-muted-foreground text-xs">
                      {entry.label}
                    </MarkerContent>
                  </Marker>
                )
              }

              if (entry.kind === "tool") {
                return (
                  <Marker key={entry.id} role="status">
                    <MarkerIcon>
                      {
                        <entry.label.icon
                          className={cn(
                            entry.status === "running" &&
                              "animate-pulse motion-reduce:animate-none",
                          )}
                        />
                      }
                    </MarkerIcon>
                    <MarkerContent className="space-x-1">{entry.label.name}</MarkerContent>
                    {entry.count > 1 && (
                      <Badge variant="outline" className="p-1 text-sm leading-none">
                        ×{entry.count}
                      </Badge>
                    )}
                    {entry.status === "done" ? (
                      <Check className="relative top-px text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Spinner />
                    )}
                  </Marker>
                )
              }

              if (entry.kind === "reasoning") {
                return (
                  <GerritReasoning
                    key={entry.id}
                    text={entry.text}
                    isActive={entry.isActive}
                    isMultiLine={entry.isMultiLine}
                    scrollRef={scrollRef}
                  />
                )
              }
            })}
            <Marker role="status">
              <MarkerContent className="shimmer text-muted-foreground text-xs">
                {elapsed > 120
                  ? "Het verwerken duurt langer dan gebruikelijk, even geduld…"
                  : "Even geduld, Gerrit is nog aan het denken…"}
              </MarkerContent>
            </Marker>
          </div>
          <div ref={bottomRef} />
        </div>
        <Button
          type="button"
          variant="outline"
          aria-label="Scrol naar beneden"
          className="bg-background/80 pointer-events-none absolute bottom-1 left-1/2 h-auto -translate-x-1/2 opacity-0 shadow-xs backdrop-blur-xs transition-opacity duration-200 group-data-scroll-end:pointer-events-auto group-data-scroll-end:opacity-100"
          onClick={() =>
            scrollRef.current?.scrollTo({
              top: scrollRef.current?.scrollHeight,
              behavior: "smooth",
            })
          }
        >
          <ChevronDown className="text-muted-foreground my-1 h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  )
}

function GerritReasoning({
  text,
  isActive,
  isMultiLine,
  scrollRef,
}: {
  text: string
  isActive: boolean
  isMultiLine: boolean
  scrollRef: RefObject<HTMLDivElement | null>
}) {
  const plain = text
    .trim()
    .split("\n")
    .map((l) => l.replace(/[*#`_]|\[([^\]]+)\]\([^)]+\)/g, "$1").trim())
  const firstLineIndex = plain.findIndex(Boolean)

  const bottomRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const statusNode = isActive ? (
    <Spinner className="inline-block shrink-0" />
  ) : (
    <Check className="relative top-px inline-block shrink-0 text-emerald-600 dark:text-emerald-400" />
  )

  if (firstLineIndex === -1) {
    return (
      <Marker className="items-start">
        <MarkerIcon className="mt-1">
          <Sparkles className={cn(isActive && "animate-pulse motion-reduce:animate-none")} />
        </MarkerIcon>
        <MarkerContent className="italic">Redenering {statusNode}</MarkerContent>
      </Marker>
    )
  }

  if (!isMultiLine) {
    return (
      <Marker className="items-start">
        <MarkerIcon className="mt-1">
          <Sparkles className={cn(isActive && "animate-pulse motion-reduce:animate-none")} />
        </MarkerIcon>
        <MarkerContent className="italic">
          {plain[firstLineIndex]} {statusNode}
        </MarkerContent>
      </Marker>
    )
  }

  return (
    <>
      <Marker className="items-start">
        <MarkerIcon className="mt-1">
          <Sparkles className={cn(isActive && "animate-pulse motion-reduce:animate-none")} />
        </MarkerIcon>
        <MarkerContent className="min-w-0 flex-1">
          <Collapsible className="group italic">
            {/* Collapsed view: Line 1 + Toon meer + statusNode */}
            <div className="space-y-1 group-data-[state=open]:hidden">
              <span className="line-clamp-2">{plain[firstLineIndex]}</span>
              <div className="flex items-center gap-1.5 text-xs">
                <CollapsibleTrigger asChild>
                  <Button
                    variant="link"
                    className="h-auto p-0 text-xs leading-none font-medium"
                    onClick={() => {
                      if (timeoutRef.current) clearTimeout(timeoutRef.current)
                      timeoutRef.current = setTimeout(() => {
                        const element = bottomRef.current
                        const scrollElement = scrollRef.current

                        if (element && scrollElement) {
                          const containerBottom = scrollElement.getBoundingClientRect().bottom
                          const { top: myTop, bottom: myBottom } = element.getBoundingClientRect()
                          if (
                            myBottom > containerBottom &&
                            containerBottom + AUTO_SCROLL_THRESHOLD > myTop
                          ) {
                            element?.scrollIntoView({ behavior: "smooth", block: "nearest" })
                          }
                        }
                      }, 50)
                    }}
                  >
                    Toon meer
                  </Button>
                </CollapsibleTrigger>
                {statusNode}
              </div>
            </div>

            {/* Expanded view: All lines + Toon minder + statusNode */}
            <CollapsibleContent className="space-y-1.5 pt-0">
              {plain.map((line, index) => (
                <p key={`reasoning-line-${index}`} className="leading-relaxed">
                  {line}
                </p>
              ))}
              <div className="flex items-center gap-1.5 pt-1 text-xs">
                <CollapsibleTrigger asChild>
                  <Button variant="link" className="h-auto p-0 text-xs leading-none font-medium">
                    Toon minder
                  </Button>
                </CollapsibleTrigger>
                {statusNode}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </MarkerContent>
      </Marker>
      <div ref={bottomRef} />
    </>
  )
}
