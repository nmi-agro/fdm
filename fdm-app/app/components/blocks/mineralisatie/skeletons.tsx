import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import { Skeleton } from "~/components/ui/skeleton"

export function MineralisatieCardSkeleton() {
    return (
        <Card className="animate-pulse">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-4 rounded-full" />
            </CardHeader>
            <CardContent>
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-3 w-24 mt-2" />
            </CardContent>
        </Card>
    )
}

export function MineralisatieChartSkeleton() {
    return (
        <Card className="animate-pulse">
            <CardHeader>
                <CardTitle>
                    <Skeleton className="h-6 w-48" />
                </CardTitle>
                <CardDescription>
                    <Skeleton className="h-4 w-full mt-2" />
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Skeleton className="h-[300px] w-full" />
            </CardContent>
        </Card>
    )
}

export function MineralisatieFieldsSkeleton() {
    return (
        <Card className="animate-pulse">
            <CardHeader>
                <CardTitle>
                    <Skeleton className="h-6 w-32" />
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div
                            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder
                            key={i}
                            className="flex items-center justify-between"
                        >
                            <Skeleton className="h-4 w-36" />
                            <Skeleton className="h-4 w-16" />
                            <Skeleton className="h-4 w-4 rounded-full" />
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}

/** Fallback for the farm overview page */
export function MineralisatieFallback() {
    return (
        <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
                <MineralisatieCardSkeleton />
                <MineralisatieCardSkeleton />
                <MineralisatieCardSkeleton />
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <div className="col-span-4">
                    <MineralisatieChartSkeleton />
                </div>
                <div className="col-span-3">
                    <MineralisatieFieldsSkeleton />
                </div>
            </div>
        </div>
    )
}

/** Fallback for the DYNA page */
export function DynaFallback() {
    return (
        <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <MineralisatieCardSkeleton />
                <MineralisatieCardSkeleton />
                <MineralisatieCardSkeleton />
                <MineralisatieCardSkeleton />
            </div>
            <MineralisatieChartSkeleton />
            <div className="grid gap-4 md:grid-cols-2">
                <Card className="animate-pulse">
                    <CardHeader>
                        <Skeleton className="h-5 w-32" />
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {Array.from({ length: 5 }).map((_, i) => (
                            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder
                            <Skeleton key={i} className="h-4 w-full" />
                        ))}
                    </CardContent>
                </Card>
                <Card className="animate-pulse">
                    <CardHeader>
                        <Skeleton className="h-5 w-32" />
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {Array.from({ length: 4 }).map((_, i) => (
                            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder
                            <Skeleton key={i} className="h-4 w-full" />
                        ))}
                    </CardContent>
                </Card>
            </div>
            <Card className="animate-pulse">
                <CardHeader>
                    <Skeleton className="h-5 w-40" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-[220px] w-full" />
                </CardContent>
            </Card>
        </div>
    )
}

/** Fallback for the field detail page */
export function MineralisatieFieldDetailFallback() {
    return (
        <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <MineralisatieCardSkeleton />
                <MineralisatieCardSkeleton />
                <MineralisatieCardSkeleton />
                <MineralisatieCardSkeleton />
            </div>
            <MineralisatieChartSkeleton />
            <div className="grid gap-4 md:grid-cols-2">
                <Card className="animate-pulse">
                    <CardHeader>
                        <Skeleton className="h-5 w-40" />
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {Array.from({ length: 6 }).map((_, i) => (
                            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder
                            <Skeleton key={i} className="h-4 w-full" />
                        ))}
                    </CardContent>
                </Card>
                <Card className="animate-pulse">
                    <CardHeader>
                        <Skeleton className="h-5 w-36" />
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {Array.from({ length: 4 }).map((_, i) => (
                            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder
                            <Skeleton key={i} className="h-4 w-full" />
                        ))}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
