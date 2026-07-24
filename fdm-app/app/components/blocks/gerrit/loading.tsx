import {
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
  getFarmLegalNorms: { name: "Wettelijke normen berekenen", icon: Landmark },
  searchFertilizers: { name: "Meststoffen zoeken", icon: Shapes },
  simulateFarmPlan: { name: "Plan doorrekenen", icon: Calculator },
}

type TimelineEntry =
  | { kind: "status"; id: string; label: string }
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
    if (event.type === "start" || event.type === "status") {
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

export function GerritLoading({ events = [] }: { events?: StreamEvent[] }) {
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
  }, [timeline.length])

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
            <Bot className="text-primary h-5 w-5 animate-pulse" />
            Gerrit is aan het werk…
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
          className="absolute top-1 left-1/2 h-auto -translate-x-1/2 opacity-0 transition-opacity duration-200 group-data-scroll-start:opacity-100"
          onClick={() =>
            scrollRef.current?.scrollTo({
              top: 0,
              behavior: "smooth",
            })
          }
        >
          <ChevronUp className="text-muted-foreground my-1 h-4 w-4" />
        </Button>
        <div ref={scrollRef} className="max-h-full overflow-y-auto" onScroll={handleScroll}>
          <div className="text-muted-foreground space-y-6 p-6 text-sm">
            {timeline.length === 0 && (
              <Marker role="status">
                <MarkerIcon>
                  <Spinner />
                </MarkerIcon>
                <MarkerContent>Voorbereiden…</MarkerContent>
              </Marker>
            )}

            {timeline.map((entry) => {
              if (entry.kind === "status") {
                return (
                  <Marker key={entry.id}>
                    <MarkerContent className="text-muted-foreground text-xs opacity-75">
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
                          className={cn(entry.status === "running" && "animate-pulse")}
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
                      <Check className="relative top-px text-emerald-400" />
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
              <MarkerContent className="shimmer text-muted-foreground text-xs opacity-75">
                Even geduld, Gerrit is nog aan het denken...
              </MarkerContent>
            </Marker>
          </div>
          <div ref={bottomRef} />
        </div>
        <Button
          type="button"
          variant="outline"
          className="absolute bottom-1 left-1/2 h-auto -translate-x-1/2 opacity-0 transition-opacity duration-200 group-data-scroll-end:opacity-100"
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
    .map((l) => l.replace(/[*#`]/g, "").trim())
  const firstLineIndex = plain.findIndex(Boolean)

  const bottomRef = useRef<HTMLDivElement>(null)

  const statusNode = isActive ? (
    <Spinner className="inline-block" />
  ) : (
    <Check className="relative top-px mx-1 inline-block text-emerald-400" />
  )

  return (
    <>
      <Marker className="items-start">
        <MarkerIcon>
          <Sparkles className={cn(isActive && "animate-pulse")} />
        </MarkerIcon>
        <MarkerContent>
          {firstLineIndex > -1 && isMultiLine ? (
            <Collapsible className="group italic">
              <CollapsibleTrigger
                className="line-clamp-2 h-auto cursor-pointer text-left group-data-[state=open]:line-clamp-none"
                onClick={() => {
                  setTimeout(() => {
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
                <span>{plain[firstLineIndex]}</span>
                <Button
                  variant="link"
                  className="h-auto px-2 py-0 leading-none group-data-[state=open]:hidden"
                  asChild
                >
                  <span>Toon meer</span>
                </Button>
                <span className="group-data-[state=open]:hidden">{statusNode}</span>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                {plain.slice(firstLineIndex + 1).map((line, index, array) => (
                  <span key={`reasoning-line-${index}`}>
                    {line}
                    {index !== array.length - 1 && <br />}
                  </span>
                ))}
                <CollapsibleTrigger asChild>
                  <Button variant="link" asChild className="px-0">
                    <span>Toon minder</span>
                  </Button>
                </CollapsibleTrigger>
                {statusNode}
              </CollapsibleContent>
            </Collapsible>
          ) : (
            <div className="italic">
              {firstLineIndex >= -1 ? text : "Redenering"}
              {statusNode}
            </div>
          )}
        </MarkerContent>
      </Marker>
      <div ref={bottomRef} />
    </>
  )
}
