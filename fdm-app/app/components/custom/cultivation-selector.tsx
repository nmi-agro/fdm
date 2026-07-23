import type { Cultivation } from "@nmi-agro/fdm-core"
import { useSearchParams } from "react-router"
import { getCultivationColor } from "~/components/custom/cultivation-colors"
import { Badge } from "~/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger } from "~/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip"

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

  const getCultivationStartTime = (value: Date | string | null | undefined) =>
    value ? new Date(value).getTime() : 0

  const formatCultivationStartDate = (value: Date | string | null | undefined) =>
    value
      ? new Date(value).toLocaleDateString("nl-NL", {
          day: "numeric",
          month: "short",
        })
      : ""

  const selectedCultivation = cultivations.find((c) => c.b_lu === selectedCultivationId)

  const sortedCultivations = [...cultivations].sort(
    (a, b) => getCultivationStartTime(b.b_lu_start) - getCultivationStartTime(a.b_lu_start),
  )

  const triggerContent =
    variant === "icon" ? (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className="h-3 w-3 cursor-pointer rounded-full"
              style={{
                backgroundColor: getCultivationColor(
                  selectedCultivation?.b_lu_croprotation ?? undefined,
                ),
              }}
            />
          </TooltipTrigger>
          <TooltipContent>
            <p>{selectedCultivation?.b_lu_name || "Selecteer gewas"}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    ) : selectedCultivation ? (
      <Badge
        style={{
          backgroundColor: getCultivationColor(selectedCultivation.b_lu_croprotation ?? undefined),
        }}
        className="px-3 py-1 text-sm text-white hover:opacity-90"
        variant="default"
      >
        {selectedCultivation.b_lu_name}
      </Badge>
    ) : (
      <span className="text-muted-foreground italic">Selecteer gewas</span>
    )

  return (
    <Select value={selectedCultivationId} onValueChange={handleValueChange}>
      <SelectTrigger className="text-foreground h-auto w-auto gap-2 border-none bg-transparent p-0 shadow-none hover:bg-transparent focus:ring-0 [&>span]:line-clamp-1 [&>svg]:hidden">
        {triggerContent}
      </SelectTrigger>
      <SelectContent>
        {sortedCultivations.map((cultivation) => (
          <SelectItem key={cultivation.b_lu} value={cultivation.b_lu}>
            <div className="flex min-w-[200px] items-center gap-3">
              <div
                className="h-3 w-3 shrink-0 rounded-full"
                style={{
                  backgroundColor: getCultivationColor(cultivation.b_lu_croprotation ?? undefined),
                }}
              />
              <span className="font-medium">{cultivation.b_lu_name}</span>
              <span className="text-muted-foreground ml-auto pl-2 text-xs">
                {formatCultivationStartDate(cultivation.b_lu_start)}
              </span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
