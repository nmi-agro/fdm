import { Bot, Wrench, MessageSquare, CheckCircle } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Spinner } from "~/components/ui/spinner"

interface StreamEvent {
    type: string
    data: any
}

export function GerritLoading({ events = [] }: { events?: StreamEvent[] }) {
    const [elapsed, setElapsed] = useState(0)
    const startRef = useRef(Date.now())
    const scrollRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const id = setInterval(
            () =>
                setElapsed(Math.floor((Date.now() - startRef.current) / 1000)),
            1000,
        )
        return () => clearInterval(id)
    }, [])

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [events])

    const elapsedStr =
        elapsed >= 60
            ? `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`
            : `${elapsed}s`

    const toolTranslations: Record<string, string> = {
        getFarmFields: "Percelen ophalen...",
        getFarmNutrientAdvice: "Bemestingsadvies ophalen...",
        getFarmLegalNorms: "Wettelijke normen berekenen...",
        searchFertilizers: "Meststoffen zoeken...",
        simulateFarmPlan: "Bemestingsplan doorrekenen...",
        getCropFertilizerGuide: "Teelthandleiding raadplegen...",
    }

    return (
        <Card className="shadow-sm flex flex-col h-[600px]">
            <CardHeader className="border-b shrink-0">
                <CardTitle className="flex items-center justify-between text-base font-semibold">
                    <span className="flex items-center gap-2">
                        <Bot className="w-5 h-5 text-primary animate-pulse" />
                        Gerrit is aan het werk…
                    </span>
                    <span className="text-sm font-normal tabular-nums text-muted-foreground">
                        {elapsedStr}
                    </span>
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef} aria-live="polite">
                {events.length === 0 ? (
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <Spinner className="h-4 w-4 shrink-0 text-primary" />
                        <span>Voorbereiden...</span>
                    </div>
                ) : (
                    events.map((event, i) => {
                        if (event.type === "on_tool_start") {
                            const translated = toolTranslations[event.data?.name] || `Gereedschap gebruiken: ${event.data?.name}`
                            return (
                                <div key={i} className="flex gap-3 text-sm bg-muted/50 p-3 rounded-md border">
                                    <Wrench className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                                    <div className="flex flex-col gap-1">
                                        <span className="font-medium text-foreground">{translated}</span>
                                    </div>
                                </div>
                            )
                        } else if (event.type === "on_tool_end") {
                            const translated = toolTranslations[event.data?.name] ? `${toolTranslations[event.data?.name].replace('...', '')} voltooid.` : "Gereedschap voltooid."
                            return (
                                <div key={i} className="flex gap-3 text-sm">
                                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                                    <span className="text-muted-foreground italic">{translated}</span>
                                </div>
                            )
                        } else if (event.type === "on_chat_model_stream") {
                            return (
                                <div key={i} className="flex gap-3 text-sm">
                                    <MessageSquare className="w-4 h-4 text-primary mt-0.5 shrink-0 opacity-50" />
                                    <span className="text-foreground whitespace-pre-wrap">{event.data?.chunk}</span>
                                </div>
                            )
                        } else if (event.type === "status") {
                            return (
                                <div key={i} className="flex gap-3 text-sm bg-primary/10 p-3 rounded-md">
                                    <Spinner className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                                    <span className="font-medium text-primary">{event.data?.message}</span>
                                </div>
                            )
                        }
                        return null
                    })
                )}
            </CardContent>
        </Card>
    )
}
