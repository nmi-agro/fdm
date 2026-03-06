import { Card, CardContent } from "~/components/ui/card"
import { Spinner } from "~/components/ui/spinner"

interface ElevationLegendProps {
    min?: number
    max?: number
    loading?: boolean
    hoverValue?: number | null
    showScale?: boolean
    networkStatus?: "idle" | "loading" | "slow" | "error"
    message?: string
}

export function ElevationLegend({
    min,
    max,
    loading,
    hoverValue,
    showScale = true,
    networkStatus,
    message,
}: ElevationLegendProps) {
    return (
        <div className="w-40">
            <Card className="bg-background/90 backdrop-blur-sm shadow-sm">
                <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Hoogte (AHN4)
                        </h4>
                        {loading && <Spinner className="h-3 w-3" />}
                    </div>

                    {networkStatus === "slow" && (
                        <div className="mb-2 text-xs font-medium text-orange-600">
                            Trage verbinding...
                        </div>
                    )}

                    {networkStatus === "error" && (
                        <div className="mb-2 text-xs font-medium text-destructive">
                            Fout bij laden
                        </div>
                    )}

                    {message && (
                        <div className="mb-2 text-xs font-medium text-muted-foreground">
                            {message}
                        </div>
                    )}

                    {showScale && (
                        <div className="flex flex-col gap-1">
                            <div className="flex h-4 w-full rounded border border-border overflow-hidden relative">
                                <div
                                    className="absolute inset-0 w-full h-full"
                                    style={{
                                        // BrewerSpectral11 Reversed (Blue -> Red)
                                        background:
                                            "linear-gradient(to right, #5e4fa2, #3288bd, #66c2a5, #abdda4, #e6f598, #ffffbf, #fee08b, #fdae61, #f46d43, #d53e4f, #9e0142)",
                                    }}
                                />
                            </div>
                            <div className="flex justify-between text-[12px] text-muted-foreground font-medium font-mono">
                                <span>
                                    {min !== undefined
                                        ? `${min.toFixed(1)}m`
                                        : "Laag"}
                                </span>
                                <span>
                                    {max !== undefined
                                        ? `${max.toFixed(1)}m`
                                        : "Hoog"}
                                </span>
                            </div>
                            {hoverValue !== undefined &&
                                hoverValue !== null && (
                                    <div className="mt-2 text-left text-xs font-bold">
                                        Hoogte: {hoverValue.toFixed(2)} m NAP
                                    </div>
                                )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
