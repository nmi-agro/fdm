import { Info } from "lucide-react"
import { Badge } from "~/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip"

/**
 * Informational banner shown on all BLN3 indicator pages.
 *
 * The BLN3 scores and list of measures are subject to change while being
 * evaluated by NMI. This banner informs users that displayed scores are not
 * definitive and the measures list may be incomplete.
 */
export function Bln3BetaBanner() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="secondary"
            className="cursor-help gap-1 border-amber-500/20 bg-amber-500/10 font-medium text-amber-600 hover:bg-amber-500/20"
          >
            <Info className="h-3 w-3" />
            In ontwikkeling
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-[300px] p-3 text-sm">
          De BLN3-scores en de lijst van maatregelen zijn nog in ontwikkeling en kunnen worden
          gewijzigd. De getoonde scores zijn niet definitief en de lijst van maatregelen is niet
          volledig.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
