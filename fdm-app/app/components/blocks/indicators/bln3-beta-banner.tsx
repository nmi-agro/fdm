import { Info } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip"
import { Badge } from "~/components/ui/badge"

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
                    <Badge variant="secondary" className="cursor-help font-medium gap-1 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border-amber-500/20">
                        <Info className="h-3 w-3" />
                        In ontwikkeling
                    </Badge>
                </TooltipTrigger>
                <TooltipContent className="max-w-[300px] text-sm p-3">
                    De BLN3-scores en de lijst van maatregelen zijn nog in
                    ontwikkeling en kunnen worden gewijzigd. De getoonde scores zijn
                    niet definitief en de lijst van maatregelen is niet volledig.
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}
