import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import { Skeleton } from "~/components/ui/skeleton"

export function GroundwaterCard({
    groundwaterEstimates,
}: {
    groundwaterEstimates: {
        b_gwl_class?: string | null
        b_gwl_ghg?: number | null
        b_gwl_glg?: number | null
    }
}) {
    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle>Grondwater</CardTitle>
                </div>
                <CardDescription>
                    De grondwaterstanden voor dit perceel volgens BRO
                    Grondwaterspiegeldiepte (WDM)
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                            Klasse
                        </p>
                        <p className="text-2xl font-bold">
                            {groundwaterEstimates.b_gwl_class ?? "Onbekend"}
                        </p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                            GHG
                        </p>
                        <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-bold">
                                {groundwaterEstimates.b_gwl_ghg ?? "Onbekend"}
                            </span>
                            {groundwaterEstimates.b_gwl_ghg != null && (
                                <span className="text-sm text-muted-foreground">
                                    cm-mv
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                            GLG
                        </p>
                        <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-bold">
                                {groundwaterEstimates.b_gwl_glg ?? "Onbekend"}
                            </span>
                            {groundwaterEstimates.b_gwl_glg != null && (
                                <span className="text-sm text-muted-foreground">
                                    cm-mv
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

export function GroundwaterSkeleton() {
    return (
        <Card>
            <CardHeader>
                <Skeleton className="h-6 w-1/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-3 gap-6">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
            </CardContent>
        </Card>
    )
}
