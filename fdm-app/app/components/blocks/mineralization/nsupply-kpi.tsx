import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Separator } from "~/components/ui/separator"
import type {
    NSupplyMethod,
    NSupplyResult,
} from "~/integrations/mineralization.server"
import { getCurrentDoy } from "./mineralization-chart"

const METHOD_LABELS: Record<NSupplyMethod, string> = {
    minip: "MINIP",
    pmn: "PMN",
    century: "Century",
}

// ─── Farm overview KPIs ───────────────────────────────────────────────────────

interface FarmNSupplyKpiProps {
    results: NSupplyResult[]
}

export function FarmNSupplyKpi({ results }: FarmNSupplyKpiProps) {
    const validResults = results.filter((r) => !r.error && r.data.length > 0)

    const totalArea = validResults.reduce((sum, r) => sum + (r.area || 0), 0)
    const avgN =
        validResults.length > 0
            ? totalArea > 0
                ? validResults.reduce(
                      (sum, r) => sum + r.totalAnnualN * (r.area || 0),
                      0,
                  ) / totalArea
                : validResults.reduce((sum, r) => sum + r.totalAnnualN, 0) /
                  validResults.length
            : 0

    const maxResult = validResults.reduce<NSupplyResult | undefined>(
        (best, r) => (!best || r.totalAnnualN > best.totalAnnualN ? r : best),
        undefined,
    )

    const minResult = validResults.reduce<NSupplyResult | undefined>(
        (low, r) => (!low || r.totalAnnualN < low.totalAnnualN ? r : low),
        undefined,
    )

    return (
        <>
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                        N Levering bedrijf
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                        {Math.round(avgN)} kg N/ha
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Gemiddeld over {validResults.length} percelen
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                        Hoogste N levering
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                        {maxResult ? Math.round(maxResult.totalAnnualN) : "—"}{" "}
                        {maxResult ? "kg N/ha" : ""}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                        {maxResult?.b_name ?? "Geen gegevens"}
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                        Laagste N levering
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                        {minResult ? Math.round(minResult.totalAnnualN) : "—"}{" "}
                        {minResult ? "kg N/ha" : ""}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                        {minResult?.b_name ?? "Geen gegevens"}
                    </p>
                </CardContent>
            </Card>
        </>
    )
}

// ─── Field detail: single model results card ──────────────────────────────────

function getNAtDoy(
    data: { doy: number; d_n_supply_actual: number }[],
    targetDoy: number,
): number | undefined {
    if (data.length === 0) return undefined
    return data.reduce((prev, curr) =>
        Math.abs(curr.doy - targetDoy) < Math.abs(prev.doy - targetDoy)
            ? curr
            : prev,
    ).d_n_supply_actual
}

interface FieldNSupplyDetailsCardProps {
    results: NSupplyResult[]
}

export function FieldNSupplyDetailsCard({
    results,
}: FieldNSupplyDetailsCardProps) {
    const bestResult =
        results.find((r) => !r.error && r.method === "minip") ??
        results.find((r) => !r.error)

    const currentDoy = getCurrentDoy()
    const todayN =
        bestResult && bestResult.data.length > 0
            ? getNAtDoy(bestResult.data, currentDoy)
            : undefined
    const progress =
        todayN != null && bestResult && bestResult.totalAnnualN > 0
            ? (todayN / bestResult.totalAnnualN) * 100
            : undefined

    const validResults = results.filter((r) => !r.error && r.data.length > 0)
    const spread =
        validResults.length >= 2
            ? Math.max(...validResults.map((r) => r.totalAnnualN)) -
              Math.min(...validResults.map((r) => r.totalAnnualN))
            : undefined

    return (
        <Card className="flex flex-col h-full">
            <CardHeader className="pb-2">
                <CardTitle className="text-base">
                    Berekeningsresultaten
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Annual total headline */}
                <div>
                    <div className="flex items-baseline gap-1.5">
                        <span className="text-3xl font-bold tracking-tight">
                            {bestResult && !bestResult.error
                                ? Math.round(bestResult.totalAnnualN)
                                : "—"}
                        </span>
                        {bestResult && !bestResult.error && (
                            <span className="text-xs font-medium text-muted-foreground">
                                kg N/ha/jaar
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {bestResult
                            ? `${METHOD_LABELS[bestResult.method]}-methode`
                            : "Geen berekening beschikbaar"}
                    </p>
                </div>

                {/* Season progress */}
                {(todayN != null || progress != null) && (
                    <div className="space-y-1.5">
                        <Separator />
                        {todayN != null && (
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">
                                    Tot vandaag
                                </span>
                                <span className="font-mono font-medium">
                                    {Math.round(todayN)} kg N/ha
                                </span>
                            </div>
                        )}
                        {progress != null && (
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">
                                    Voortgang dit jaar
                                </span>
                                <span className="font-mono font-medium">
                                    {Math.round(progress)}%
                                </span>
                            </div>
                        )}
                    </div>
                )}

                {/* Per-method breakdown */}
                <div className="space-y-1.5">
                    <Separator />
                    {results.map((r) => (
                        <div
                            key={r.method}
                            className="flex items-center justify-between text-sm"
                        >
                            <span className="text-muted-foreground">
                                {METHOD_LABELS[r.method]}
                            </span>
                            {r.error ? (
                                <span className="text-xs text-destructive">
                                    Niet beschikbaar
                                </span>
                            ) : (
                                <span className="font-mono font-medium">
                                    {Math.round(r.totalAnnualN)} kg N/ha
                                </span>
                            )}
                        </div>
                    ))}
                    {spread != null && (
                        <div className="flex items-center justify-between text-sm pt-1">
                            <span className="text-muted-foreground">
                                Spreiding methoden
                            </span>
                            <span className="font-mono text-xs text-muted-foreground">
                                ±{Math.round(spread / 2)} kg N/ha
                            </span>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}

// ─── Legacy field KPI fragments (kept for farm overview) ─────────────────────

interface FieldNSupplyKpiProps {
    results: NSupplyResult[]
    soilType?: string
    organicMatter?: number
}

export function FieldNSupplyKpi({
    results,
    soilType,
    organicMatter,
}: FieldNSupplyKpiProps) {
    const bestResult =
        results.find((r) => !r.error && r.method === "minip") ??
        results.find((r) => !r.error)

    const successfulCount = results.filter((r) => !r.error).length

    return (
        <>
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                        N Levering
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                        {bestResult && !bestResult.error
                            ? `${Math.round(bestResult.totalAnnualN)} kg N/ha`
                            : "—"}
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Jaarlijks cumulatief
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                        Methoden
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                        {successfulCount} / {results.length}
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {results
                            .filter((r) => !r.error)
                            .map((r) => METHOD_LABELS[r.method])
                            .join(", ") || "Geen"}
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                        Bodemtype
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{soilType ?? "—"}</div>
                    <p className="text-xs text-muted-foreground">
                        Bodembeschrijving
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                        Organische Stof
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                        {organicMatter != null
                            ? `${Math.round(organicMatter)}%`
                            : "—"}
                    </div>
                    <p className="text-xs text-muted-foreground">a_som_loi</p>
                </CardContent>
            </Card>
        </>
    )
}
