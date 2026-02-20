import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import { Skeleton } from "~/components/ui/skeleton"

export function SoilTextureCard({
    soilParameterEstimates,
}: {
    soilParameterEstimates: {
        a_clay_mi: number
        a_silt_mi: number
        a_sand_mi: number
    }
}) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Textuur</CardTitle>
                <CardDescription>
                    De geschatte textuur van de bodem voor dit perceel.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                            Klei
                        </p>
                        <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-bold">
                                {soilParameterEstimates.a_clay_mi}
                            </span>
                            <span className="text-sm text-muted-foreground">
                                %
                            </span>
                        </div>
                    </div>
                    <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                            Silt
                        </p>
                        <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-bold">
                                {soilParameterEstimates.a_silt_mi}
                            </span>
                            <span className="text-sm text-muted-foreground">
                                %
                            </span>
                        </div>
                    </div>
                    <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                            Zand
                        </p>
                        <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-bold">
                                {soilParameterEstimates.a_sand_mi}
                            </span>
                            <span className="text-sm text-muted-foreground">
                                %
                            </span>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

export function SoilTextureSkeleton() {
    return (
        <Card>
            <CardHeader>
                <Skeleton className="h-6 w-1/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
            </CardContent>
        </Card>
    )
}
