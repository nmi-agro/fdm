import { Info } from "lucide-react"
import { Alert, AlertDescription } from "~/components/ui/alert"

/**
 * Informational banner shown on all BLN3 indicator pages.
 *
 * The BLN3 scores and list of measures are subject to change while being
 * evaluated by NMI. This banner informs users that displayed scores are not
 * definitive and the measures list may be incomplete.
 */
export function Bln3BetaBanner() {
    return (
        <Alert className="flex border-muted bg-muted/50 text-muted-foreground items-center">
            <Info className="h-4" />
            <AlertDescription className="ml-2 pt-1 items-center">
                De BLN3-scores en de lijst van maatregelen zijn nog in
                ontwikkeling en kunnen worden gewijzigd. De getoonde scores zijn
                niet definitief en de lijst van maatregelen is niet volledig.
            </AlertDescription>
        </Alert>
    )
}
