import { ChevronDown, ChevronUp, Copy } from "lucide-react"
import { useState } from "react"
import { useParams } from "react-router"
import { toast } from "sonner"
import { getCultivationColor } from "~/components/custom/cultivation-colors"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import { Separator } from "~/components/ui/separator"
import { Skeleton } from "~/components/ui/skeleton"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "~/components/ui/tooltip"
import { cn } from "~/lib/utils"

type CultivationHistory = {
    year: number
    b_lu_catalogue: string
    b_lu_name?: string
    b_lu_croprotation?: string
    b_lu_rest_oravib?: boolean
}

export function CultivationHistoryCard({
    cultivationHistory,
}: {
    cultivationHistory: CultivationHistory[]
}) {
    const params = useParams()
    const currentYear = Number(params.calendar)
    const [isExpanded, setIsExpanded] = useState(false)
    const mobileLimit = 6
    const hasMore = cultivationHistory.length > mobileLimit

    const handleCopy = () => {
        const header = "jaar\tgewascode\tgewas\tis_rustgewas"
        const rows = cultivationHistory.map(
            (cultivation) =>
                `${cultivation.year}\t${cultivation.b_lu_catalogue.replace(
                    /^nl_/,
                    "",
                )}\t${cultivation.b_lu_name ?? ""}\t${
                    cultivation.b_lu_rest_oravib ? "Ja" : "Nee"
                }`,
        )
        const tsv = [header, ...rows].join("\n")

        navigator.clipboard.writeText(tsv).then(
            () => {
                toast.success("Gekopieerd naar klembord")
            },
            () => {
                toast.error("Kopiëren naar klembord mislukt")
            },
        )
    }

    return (
        <Card className="col-span-1 lg:row-span-2 overflow-hidden">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <CardTitle className="text-xl font-bold">
                            Gewashistorie
                        </CardTitle>
                    </div>
                    <CardDescription>
                        Dit zijn de gewassen zoals geregistreerd in de
                        Basisregistratie Gewaspercelen (BRP).
                    </CardDescription>
                </div>
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={handleCopy}
                                aria-label="Kopieer naar klembord"
                            >
                                <Copy className="h-3.5 w-3.5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Kopieer naar klembord</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </CardHeader>

            <Separator className="opacity-50" />

            <CardContent className="pt-6 text-sm">
                <div className="relative pl-1">
                    {cultivationHistory.map((cultivation, index) => {
                        const isHiddenOnMobile =
                            !isExpanded && index >= mobileLimit
                        const isActive = cultivation.year === currentYear

                        return (
                            <div
                                key={cultivation.year}
                                className={cn(
                                    "flex items-start space-x-4 pb-6 relative group",
                                    isHiddenOnMobile && "hidden lg:flex",
                                    isActive && "opacity-100",
                                )}
                            >
                                {/* Timeline Line */}
                                {index !== cultivationHistory.length - 1 && (
                                    <div
                                        className={cn(
                                            "absolute left-[19px] top-10 h-full w-0.5 bg-border transition-colors group-hover:bg-primary/30",
                                            isHiddenOnMobile &&
                                                "hidden lg:block",
                                            isActive && "bg-primary/30",
                                        )}
                                    />
                                )}

                                {/* Dot */}
                                <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-background">
                                    <div
                                        className={cn(
                                            "h-8 w-8 rounded-full flex items-center justify-center transition-all",
                                            isActive &&
                                                "ring-2 ring-primary ring-offset-2",
                                        )}
                                        style={{
                                            backgroundColor:
                                                getCultivationColor(
                                                    cultivation.b_lu_croprotation,
                                                ),
                                            opacity: 0.2,
                                        }}
                                    />
                                    <div
                                        className="absolute h-3 w-3 rounded-full shadow-sm"
                                        style={{
                                            backgroundColor:
                                                getCultivationColor(
                                                    cultivation.b_lu_croprotation,
                                                ),
                                        }}
                                    />
                                </div>

                                {/* Content */}
                                <div className="min-w-0 flex-1 py-1">
                                    <div className="flex items-center gap-2">
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <p
                                                        className={cn(
                                                            "font-semibold truncate cursor-help",
                                                            isActive
                                                                ? "text-primary"
                                                                : "text-foreground/80",
                                                        )}
                                                    >
                                                        {cultivation.b_lu_name ??
                                                            "Onbekend gewas"}
                                                    </p>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>
                                                        {cultivation.b_lu_name ??
                                                            "Onbekend gewas"}
                                                    </p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                        {isActive && (
                                            <Badge
                                                variant="default"
                                                className="h-4 px-1.5 text-[9px] uppercase font-black"
                                            >
                                                Nu
                                            </Badge>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                        <span className="text-xs font-bold tabular-nums text-muted-foreground/70">
                                            {cultivation.year}
                                        </span>
                                        {cultivation.b_lu_rest_oravib && (
                                            <>
                                                <span className="text-[10px] text-muted-foreground/50">
                                                    •
                                                </span>
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-green-600 dark:text-green-400">
                                                    Rustgewas
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>

                {hasMore && (
                    <div className="lg:hidden pt-2 border-t mt-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="w-full text-muted-foreground hover:text-foreground h-10"
                            onClick={() => setIsExpanded(!isExpanded)}
                        >
                            {isExpanded ? (
                                <>
                                    <ChevronUp className="mr-2 h-4 w-4" />
                                    Minder jaren tonen
                                </>
                            ) : (
                                <>
                                    <ChevronDown className="mr-2 h-4 w-4" />
                                    Meer jaren tonen (
                                    {cultivationHistory.length - mobileLimit})
                                </>
                            )}
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

export function CultivationHistorySkeleton() {
    const SKELETON_KEYS = ["sk-1", "sk-2", "sk-3"] as const

    return (
        <Card className="col-span-1 lg:row-span-2 overflow-hidden">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
                <div className="space-y-1">
                    <CardTitle>Gewashistorie</CardTitle>
                    <CardDescription>
                        Dit zijn de gewassen zoals geregistreerd in de
                        Basisregistratie Gewaspercelen (BRP).
                    </CardDescription>
                </div>
                <Skeleton className="h-8 w-8 rounded-md shrink-0" />
            </CardHeader>
            <Separator className="opacity-50" />
            <CardContent className="pt-6 text-sm">
                <div className="relative pl-1">
                    {SKELETON_KEYS.map((key, index) => (
                        <div
                            key={key}
                            className="flex items-start space-x-4 pb-6 relative"
                        >
                            {index !== SKELETON_KEYS.length - 1 && (
                                <div className="absolute left-[19px] top-10 h-full w-0.5 bg-border" />
                            )}
                            <Skeleton className="relative z-10 h-10 w-10 rounded-full shrink-0" />
                            <div className="min-w-0 flex-1 py-1 space-y-2">
                                <Skeleton className="h-4 w-3/4" />
                                <Skeleton className="h-3 w-1/4" />
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}
