import type { Cultivation } from "@nmi-agro/fdm-core"
import { useSearchParams } from "react-router"
import { getCultivationColor } from "~/components/custom/cultivation-colors"
import { Badge } from "~/components/ui/badge"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
} from "~/components/ui/select"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "~/components/ui/tooltip"

interface CultivationSelectorProps {
    cultivations: Cultivation[]
    selectedCultivationId: string
    variant?: "default" | "icon"
}

export function CultivationSelector({
    cultivations,
    selectedCultivationId,
    variant = "default",
}: CultivationSelectorProps) {
    const [_searchParams, setSearchParams] = useSearchParams()

    const handleValueChange = (value: string) => {
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev)
            next.set("cultivation", value)
            return next
        })
    }

    const selectedCultivation = cultivations.find(
        (c) => c.b_lu === selectedCultivationId,
    )

    const sortedCultivations = [...cultivations].sort(
        (a, b) =>
            new Date(b.b_lu_start).getTime() - new Date(a.b_lu_start).getTime(),
    )

    const triggerContent =
        variant === "icon" ? (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div
                            className="w-3 h-3 rounded-full cursor-pointer"
                            style={{
                                backgroundColor: getCultivationColor(
                                    selectedCultivation?.b_lu_croprotation,
                                ),
                            }}
                        />
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>
                            {selectedCultivation?.b_lu_name ||
                                "Selecteer gewas"}
                        </p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        ) : selectedCultivation ? (
            <Badge
                style={{
                    backgroundColor: getCultivationColor(
                        selectedCultivation.b_lu_croprotation,
                    ),
                }}
                className="text-white hover:opacity-90 px-3 py-1 text-sm"
                variant="default"
            >
                {selectedCultivation.b_lu_name}
            </Badge>
        ) : (
            <span className="text-muted-foreground italic">
                Selecteer gewas
            </span>
        )

    return (
        <Select value={selectedCultivationId} onValueChange={handleValueChange}>
            <SelectTrigger className="w-auto h-auto gap-2 border-none bg-transparent p-0 hover:bg-transparent focus:ring-0 shadow-none text-foreground [&>span]:line-clamp-1 [&>svg]:hidden">
                {triggerContent}
            </SelectTrigger>
            <SelectContent>
                {sortedCultivations.map((cultivation) => (
                    <SelectItem key={cultivation.b_lu} value={cultivation.b_lu}>
                        <div className="flex items-center gap-3 min-w-[200px]">
                            <div
                                className="w-3 h-3 rounded-full shrink-0"
                                style={{
                                    backgroundColor: getCultivationColor(
                                        cultivation.b_lu_croprotation,
                                    ),
                                }}
                            />
                            <span className="font-medium">
                                {cultivation.b_lu_name}
                            </span>
                            <span className="text-muted-foreground text-xs ml-auto pl-2">
                                {new Date(
                                    cultivation.b_lu_start,
                                ).toLocaleDateString("nl-NL", {
                                    day: "numeric",
                                    month: "short",
                                })}
                            </span>
                        </div>
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
}
