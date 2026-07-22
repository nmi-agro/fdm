import { Bot, ChevronDown, ChevronUp, Sparkles } from "lucide-react"
import { type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Marker, MarkerContent, MarkerIcon } from "~/components/ui/marker"
import { Spinner } from "~/components/ui/spinner"

interface StreamEvent {
  type: string
  data: any
}

interface ClarifyLoadingProps {
  events?: StreamEvent[]
}

const AUTO_SCROLL_THRESHOLD = 100 // px from bottom of reasoning feed to trigger auto-scroll

export function ClarifyLoading({ events = [] }: ClarifyLoadingProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const [reasoning, setReasoning] = useState<ReactNode>(null)
  const [lastScrolledTo, setLastScrolledTo] = useState<number>(0) // Track the last scroll position to determine if we should auto-scroll

  // Extract the latest reasoning preview from events
  useEffect(() => {
    let reasoning = ""
    for (const e of events) {
      if (e.type === "reasoning") reasoning += e.data?.chunk ?? ""
    }
    const reasoningElements = reasoning
      .replace(/[*#`]/g, "")
      .split("\n")
      .filter((line) => line.trim() !== "")
      .map((line, index) => <p key={index}>{line}</p>)
    setReasoning(reasoningElements)
  }, [events])

  // Auto-scroll the reasoning feed when it's open and growing.
  // Each reasoning chunk can be longer than the marker elements found in GerritLoading, so the algorithm
  // uses the reasoning p elements directly instead of a bottom sentinel div.
  useLayoutEffect(() => {
    const scrollElement = scrollRef.current
    if (!scrollElement || scrollElement.children.length <= lastScrolledTo) return
    if (scrollElement.children.length - 1 <= lastScrolledTo) return
    const element = scrollElement.children[scrollElement.children.length - 1]
    if (
      element?.parentElement &&
      element.parentElement.getBoundingClientRect().bottom + AUTO_SCROLL_THRESHOLD >
        element.getBoundingClientRect().bottom
    ) {
      element?.parentElement.scrollTo({
        behavior: "smooth",
        top: element?.parentElement.scrollHeight,
      })
    }
    setLastScrolledTo(scrollElement.children.length - 1)
  }, [reasoning, lastScrolledTo])

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

  return (
    <Card className="shadow-sm">
      <CardHeader className="shrink-0 border-b">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Bot className="text-primary h-5 w-5 animate-pulse" />
          Gerrit bekijkt het bedrijf…
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-6">
        <Marker>
          <MarkerIcon>
            <Spinner className="text-primary h-4 w-4 shrink-0" />
          </MarkerIcon>
          <MarkerContent>
            Gerrit analyseert de gewassen, normen en beschikbare meststoffen om te bepalen of er
            gerichte vragen nodig zijn.
          </MarkerContent>
        </Marker>
        {reasoning && (
          <Marker className="items-start">
            <MarkerIcon className="mt-2">
              <Sparkles className="text-primary animate-pulse" />
            </MarkerIcon>
            <MarkerContent className="grow">
              <div
                ref={scrollContainerRef}
                className="group border-muted relative max-h-72 rounded-md border"
              >
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
                <div
                  ref={scrollRef}
                  onScroll={handleScroll}
                  className="text-italic size-full space-y-2 overflow-y-auto px-3 py-2 text-sm"
                >
                  {reasoning}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="absolute bottom-1 left-1/2 h-auto -translate-x-1/2 opacity-0 transition-opacity duration-200 group-data-scroll-end:opacity-100"
                  onClick={() =>
                    scrollRef.current?.scrollTo({
                      top: scrollRef.current.scrollHeight,
                      behavior: "smooth",
                    })
                  }
                >
                  <ChevronDown className="text-muted-foreground my-1 h-4 w-4" />
                </Button>
              </div>
            </MarkerContent>
          </Marker>
        )}
      </CardContent>
    </Card>
  )
}
