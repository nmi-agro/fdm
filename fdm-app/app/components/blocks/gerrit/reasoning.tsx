import { ChevronDown, ChevronUp, Lightbulb } from "lucide-react"
import { useState } from "react"
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import type { FarmTotals } from "./types"

interface ReasoningBullet {
    label: string
    text: string
    status?: "ok" | "warning" | "info"
}

interface GerritReasoningProps {
    summary: string
    farmTotals?: FarmTotals | null
    activeStrategyLabels: string[]
}

function buildBullets(
    farmTotals: FarmTotals | null | undefined,
    activeStrategyLabels: string[],
): ReasoningBullet[] {
    const bullets: ReasoningBullet[] = []
    if (!farmTotals) return bullets

    const { normsFilling, norms, nBalance } = farmTotals

    // Nitrogen status
    if (norms.nitrogen > 0) {
        const pct = Math.round((normsFilling.nitrogen / norms.nitrogen) * 100)
        bullets.push({
            label: "Werkzame stikstof",
            text:
                pct >= 95
                    ? `${pct}% van de gebruiksruimte benut — bijna volledig gevuld`
                    : `${pct}% van de gebruiksruimte benut`,
            status: pct > 100 ? "warning" : pct >= 90 ? "info" : "ok",
        })
    }

    // Phosphate status
    if (norms.phosphate > 0) {
        const pct = Math.round(
            (normsFilling.phosphate / norms.phosphate) * 100,
        )
        bullets.push({
            label: "Fosfaat",
            text:
                pct < 80
                    ? `${pct}% gevuld — er is nog ruimte voor bijsturing`
                    : `${pct}% van de fosfaatgebruiksruimte benut`,
            status: pct > 100 ? "warning" : "ok",
        })
    }

    // Manure status
    if (
        norms.manure > 0 &&
        activeStrategyLabels.some((l) => l.toLowerCase().includes("mest"))
    ) {
        const pct = Math.round((normsFilling.manure / norms.manure) * 100)
        bullets.push({
            label: "Dierlijke mest",
            text: `${pct}% van de dierlijke mestnorm benut`,
            status: pct > 100 ? "warning" : "ok",
        })
    }

    // N-balance
    if (nBalance) {
        const isOnTarget = nBalance.balance <= nBalance.target
        bullets.push({
            label: "Stikstofbalans",
            text: isOnTarget
                ? `${Math.round(nBalance.balance)} kg N/ha — binnen de doelwaarde van ${Math.round(nBalance.target)} kg N/ha`
                : `${Math.round(nBalance.balance)} kg N/ha — boven de doelwaarde van ${Math.round(nBalance.target)} kg N/ha`,
            status: isOnTarget ? "ok" : "warning",
        })
    }

    return bullets
}

const statusClass: Record<string, string> = {
    ok: "text-green-700",
    warning: "text-amber-700",
    info: "text-blue-700",
}

export function GerritReasoning({
    summary,
    farmTotals,
    activeStrategyLabels,
}: GerritReasoningProps) {
    const [expanded, setExpanded] = useState(false)
    const bullets = buildBullets(farmTotals, activeStrategyLabels)

    return (
        <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-primary">
                    <Lightbulb className="w-4 h-4" />
                    Gerrit's redenering
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {bullets.length > 0 && (
                    <ul className="space-y-2">
                        {bullets.map((b) => (
                            <li key={b.label} className="flex gap-3 text-sm">
                                <span className="font-medium text-foreground min-w-[140px] shrink-0">
                                    {b.label}
                                </span>
                                <span
                                    className={
                                        statusClass[b.status ?? "ok"] ??
                                        "text-muted-foreground"
                                    }
                                >
                                    {b.text}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}

                <button
                    type="button"
                    onClick={() => setExpanded((v) => !v)}
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                    {expanded ? (
                        <>
                            <ChevronUp className="w-3 h-3" />
                            Verberg volledige toelichting
                        </>
                    ) : (
                        <>
                            <ChevronDown className="w-3 h-3" />
                            Toon volledige toelichting
                        </>
                    )}
                </button>

                {expanded && (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground italic border-t border-primary/10 pt-3">
                        "{summary}"
                    </p>
                )}
            </CardContent>
        </Card>
    )
}
