import { Loader2 } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip"

/**
 * A small, scoped spinner shown next to a specific field (or farm) whose calculation result is
 * stale/missing and is being recomputed in the background. Intentionally tiny and inline so it
 * never reads as a page-wide loading state — only the affected row is marked.
 */
export function CalculationRefreshSpinner({
  label = "Wordt opnieuw berekend...",
}: {
  label?: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Loader2
          className="h-4 w-4 shrink-0 animate-spin text-muted-foreground"
          aria-label={label}
        />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
