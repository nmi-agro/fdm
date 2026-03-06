import { format } from "date-fns"
import { nl } from "date-fns/locale/nl"
import React from "react"
import { cn } from "@/app/lib/utils"

export function DateRangeDisplay({
    range,
    emptyContent = null,
    className,
}: {
    range: Date[] | undefined
    emptyContent?: React.ReactNode
    className?: string
}) {
    const formattedDateRange = React.useMemo(() => {
        const formatter = (date: Date) => format(date, "PP", { locale: nl })
        if (!range?.length) return emptyContent
        if (range.length === 1) return formatter(range[0])
        const sorted = [...range].sort((a, b) => a.getTime() - b.getTime())
        const start = sorted[0]
        const end = sorted[sorted.length - 1]
        return `${formatter(start)} - ${formatter(end)}`
    }, [range, emptyContent])
    return (
        <span
            className={cn("text-muted-foreground whitespace-nowrap", className)}
        >
            {formattedDateRange}
        </span>
    )
}
