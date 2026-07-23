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
      <CardHeader className="shrink-0 border-b">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Bot className="text-primary h-5 w-5 animate-pulse" />
          Gerrit bekijkt het bedrijf…
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-6">
        <div className="text-muted-foreground flex items-center gap-3 text-sm">
          <Spinner className="text-primary h-4 w-4 shrink-0" />
          <span>
            Gerrit analyseert de gewassen, normen en beschikbare meststoffen om te bepalen of er
            gerichte vragen nodig zijn.
          </span>
        </div>
        {preview && (
          <div
            className={cn("bg-muted/30 flex items-start gap-2 rounded-md border px-3 py-2 text-sm")}
          >
            <Sparkles className="text-primary mt-0.5 h-4 w-4 shrink-0 animate-pulse" />
            <span className="text-muted-foreground line-clamp-2 italic">{preview}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
