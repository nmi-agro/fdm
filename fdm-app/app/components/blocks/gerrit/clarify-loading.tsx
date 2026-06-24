import { Bot, Sparkles } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Spinner } from "~/components/ui/spinner"
import { cn } from "~/lib/utils"

interface StreamEvent {
    type: string
    data: any
}

interface ClarifyLoadingProps {
    events?: StreamEvent[]
}

export function ClarifyLoading({ events = [] }: ClarifyLoadingProps) {
    // Extract the latest reasoning preview from events
    let reasoning = ""
    for (const e of events) {
        if (e.type === "reasoning") reasoning += e.data?.chunk ?? ""
    }
    const preview = reasoning
        .trim()
        .split("\n")
        .map((l) => l.replace(/[*#`]/g, "").trim())
        .filter(Boolean)
        .pop()

    return (
        <Card className="shadow-sm">
            <CardHeader className="border-b shrink-0">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                    <Bot className="w-5 h-5 text-primary animate-pulse" />
                    Gerrit bekijkt het bedrijf…
                </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Spinner className="h-4 w-4 text-primary shrink-0" />
                    <span>Gerrit analyseert de gewassen, normen en beschikbare meststoffen om te bepalen of er gerichte vragen nodig zijn.</span>
                </div>
                {preview && (
                    <div className={cn("flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm")}>
                        <Sparkles className="h-4 w-4 shrink-0 text-primary mt-0.5 animate-pulse" />
                        <span className="italic text-muted-foreground line-clamp-2">{preview}</span>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
