import { Bot } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import { Spinner } from "~/components/ui/spinner"

export function GerritLoading() {
    const [elapsed, setElapsed] = useState(0)
    const startRef = useRef(Date.now())
    useEffect(() => {
        const id = setInterval(
            () =>
                setElapsed(Math.floor((Date.now() - startRef.current) / 1000)),
            1000,
        )
        return () => clearInterval(id)
    }, [])
    const elapsedStr =
        elapsed >= 60
            ? `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`
            : `${elapsed}s`
    return (
        <Card className="shadow-sm">
            <CardHeader>
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
            <CardContent>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Spinner className="h-4 w-4 shrink-0 text-primary" />
                    <span>
                        Dit kan enkele minuten tot een kwartier duren,
                        afhankelijk van het gekozen model en de omvang van het
                        bedrijf.
                    </span>
                </div>
            </CardContent>
        </Card>
    )
}
