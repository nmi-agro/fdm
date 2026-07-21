import {
  BookOpenText,
  Bot,
  Calculator,
  Check,
  CircleCheck,
  Folder,
  Landmark,
  Shapes,
  Sparkles,
  Sprout,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
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
  getFarmFields: { name: "Gegevens verzamelen", icon: Folder },
  getCropFertilizerGuide: { name: "Teelthandleiding raadplegen", icon: Sprout },
  getFarmNutrientAdvice: { name: "Bemestingsadvies ophalen", icon: BookOpenText },
  getFarmLegalNorms: { name: "Wettelijke normen berekenen", icon: Landmark },
  searchFertilizers: { name: "Meststoffen zoeken", icon: Shapes },
  simulateFarmPlan: { name: "Plan doorrekenen", icon: Calculator },
}

type TimelineEntry =
  | { kind: "separator"; id: string; label: string }
  | {
      kind: "tool"
      id: string
      toolName: string
      label: (typeof TOOL_LABELS)[string]
      status: "running" | "done"
      count: number
    }
  | { kind: "reasoning"; id: string; text: string; isActive: boolean }

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

  for (const event of events) {
    if (event.type === "start" || event.type === "status") {
      const label = event.data?.message
      if (label) {
        entries.push({ kind: "separator", id: `sep-${entries.length}`, label })
      }
    } else if (event.type === "on_tool_start") {
      const name = event.data?.name
      if (!name) continue
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
          id: `tool-${name}`,
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
      if (reasoningIndex === -1) {
        // First reasoning chunk — insert a new note entry at current position
        reasoningIndex = entries.length
        entries.push({ kind: "reasoning", id: "reasoning", text: chunk, isActive: true })
      } else {
        ;(entries[reasoningIndex] as Extract<TimelineEntry, { kind: "reasoning" }>).text += chunk
      }
    }
  }

  // Mark reasoning inactive once any tool fires after it, or on finalize
  const lastToolIdx = Math.max(...toolIndex.values(), -1)
  if (reasoningIndex !== -1 && lastToolIdx > reasoningIndex) {
    ;(entries[reasoningIndex] as Extract<TimelineEntry, { kind: "reasoning" }>).isActive = false
  }

  return entries
}

export function GerritLoading({ events = [] }: { events?: StreamEvent[] }) {
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef(Date.now())
  const bottomRef = useRef<HTMLDivElement>(null)

  function scrollToIfClose(element: HTMLElement | null) {
    if (
      element?.parentElement &&
      element.parentElement.getBoundingClientRect().bottom + 40 >
        element.getBoundingClientRect().top
    ) {
      element?.scrollIntoView({ behavior: "smooth", block: "nearest" })
    }
  }

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
    scrollToIfClose(bottomRef.current)
  }, [timeline.length])

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
      <CardContent className="text-muted-foreground max-h-72 space-y-6 overflow-y-auto p-6 text-sm">
        {timeline.length === 0 && (
          <Marker role="status">
            <MarkerIcon>
              <Spinner />
            </MarkerIcon>
            <MarkerContent>Voorbereiden…</MarkerContent>
          </Marker>
        )}

        {timeline.map((entry) => {
          if (entry.kind === "separator") {
            return (
              <Marker key={entry.id} variant="separator">
                <MarkerContent>{entry.label}</MarkerContent>
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
                {entry.count > 1 && <Badge className="text-sm">×{entry.count}</Badge>}
                {entry.status === "done" ? <CircleCheck /> : undefined}
              </Marker>
            )
          }

          if (entry.kind === "reasoning") {
            const plain = entry.text
              .trim()
              .split("\n")
              .map((l) => l.replace(/[*#`]/g, "").trim())
            const firstLineIndex = plain.findIndex(Boolean)

            return (
              <Marker key={entry.id}>
                <MarkerIcon>
                  <Sparkles className={cn(entry.isActive && "animate-pulse")} />
                </MarkerIcon>
                <MarkerContent>
                  {firstLineIndex > -1 ? (
                    <Collapsible className="group italic">
                      <CollapsibleTrigger className="line-clamp-2 cursor-pointer text-left group-data-[state=open]:line-clamp-none">
                        <span>{plain[firstLineIndex]}</span>
                        <Button
                          variant="link"
                          className="px-2 group-data-[state=open]:hidden"
                          asChild
                        >
                          <span>Toon meer</span>
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        {plain.slice(firstLineIndex + 1).map((line, index) => (
                          <span key={`reasoning-line-${index}`}>
                            {line}
                            {index !== plain.length - 1 && <br />}
                          </span>
                        ))}
                        <CollapsibleTrigger asChild>
                          <Button variant="link" asChild className="px-0" ref={scrollToIfClose}>
                            <span>Toon minder</span>
                          </Button>
                        </CollapsibleTrigger>
                      </CollapsibleContent>
                    </Collapsible>
                  ) : (
                    "Redenering"
                  )}
                </MarkerContent>
              </Marker>
            )
          }
        })}
        <div ref={bottomRef} />
      </CardContent>
    </Card>
  )
}
