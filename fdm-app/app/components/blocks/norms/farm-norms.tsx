import type {
    AggregatedNormFillingsToFarmLevel,
    AggregatedNormsToFarmLevel,
} from "@nmi-agro/fdm-calculator"
import { AlertTriangle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { NormCard } from "./norm-card"

interface FarmNormsProps {
    farmNorms: AggregatedNormsToFarmLevel
    farmFillings: AggregatedNormFillingsToFarmLevel | undefined
    hasFieldNormErrors: boolean
    fieldErrorMessages: string[]
}

export function FarmNorms({
    farmNorms,
    farmFillings,
    hasFieldNormErrors,
    fieldErrorMessages,
}: FarmNormsProps) {
    return (
        <div>
            {hasFieldNormErrors && (
                <Alert variant="destructive" className="mb-6">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Fouten bij perceelsnormen</AlertTitle>
                    <AlertDescription>
                        <p>
                            Voor één of meerdere percelen konden de
                            gebruiksnormen niet volledig worden berekend. De
                            totalen op bedrijfsniveau kunnen hierdoor afwijken.
                        </p>
                        <ul className="list-disc pl-5 mt-2 text-xs">
                            {fieldErrorMessages.map((msg) => (
                                <li key={msg}>{msg}</li>
                            ))}
                        </ul>
                    </AlertDescription>
                </Alert>
            )}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <NormCard
                    title="Stikstof, werkzaam"
                    type="farm"
                    norm={farmNorms.nitrogen}
                    filling={farmFillings?.nitrogen}
                    unit="kg N"
                />
                <NormCard
                    title="Fosfaat"
                    type="farm"
                    norm={farmNorms.phosphate}
                    filling={farmFillings?.phosphate}
                    unit="kg P₂O₅"
                />
                <NormCard
                    title="Stikstof uit dierlijke mest"
                    type="farm"
                    norm={farmNorms.manure}
                    filling={farmFillings?.manure}
                    unit="kg N"
                />
            </div>
        </div>
    )
}
