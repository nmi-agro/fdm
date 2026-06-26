import type { Cultivation, Harvest } from "@nmi-agro/fdm-core"
import { getCultivationColor } from "~/components/custom/cultivation-colors"
import { Badge } from "~/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog"
import { getDefaultCultivation } from "~/lib/cultivation-helpers"

interface FieldCultivationsBadgeProps {
  cultivations: Cultivation[]
  calendarYear: string
  harvestsMap: Map<string, Harvest[]>
  fieldName: string
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "–"
  return new Date(date).toLocaleDateString("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function formatHarvestDates(harvests: Harvest[] | undefined): string {
  if (!harvests || harvests.length === 0) return "–"
  return (
    harvests
      .map((h) => formatDate(h.b_lu_harvest_date))
      .filter((d) => d !== "–")
      .join(", ") || "–"
  )
}

export function FieldCultivationsBadge({
  cultivations,
  calendarYear,
  harvestsMap,
  fieldName,
}: FieldCultivationsBadgeProps) {
  if (cultivations.length === 0) return null

  const mainCultivation = getDefaultCultivation(cultivations, calendarYear)
  if (!mainCultivation) return null

  const extraCount = cultivations.length - 1
  const color = getCultivationColor(mainCultivation.b_lu_croprotation ?? undefined)

  const sortedCultivations = [...cultivations].sort(
    (a, b) => +(a.b_lu_start ?? 0) - +(b.b_lu_start ?? 0),
  )

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1 cursor-pointer"
          aria-label={`Bekijk teelten voor ${fieldName}`}
        >
          <Badge
            variant="default"
            className="text-white text-xs font-normal shrink-0"
            style={{
              backgroundColor: color,
            }}
          >
            {mainCultivation.b_lu_name ?? "Onbekend"}
          </Badge>
          {extraCount > 0 && (
            <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">
              +{extraCount}
            </span>
          )}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Teelten voor {fieldName}</DialogTitle>
        </DialogHeader>
        <div className="mt-2 space-y-3">
          {/* Header row */}
          <div className="grid grid-cols-4 gap-2 text-xs font-semibold text-muted-foreground border-b pb-2">
            <span>Gewas</span>
            <span>Start</span>
            <span>Einde</span>
            <span>Oogst</span>
          </div>
          {/* Cultivation rows */}
          {sortedCultivations.map((cultivation) => (
            <div key={cultivation.b_lu} className="grid grid-cols-4 gap-2 text-sm items-start">
              <span className="font-medium truncate">
                {cultivation.b_lu_name ?? "Onbekend gewas"}
              </span>
              <span className="text-muted-foreground">{formatDate(cultivation.b_lu_start)}</span>
              <span className="text-muted-foreground">{formatDate(cultivation.b_lu_end)}</span>
              <span className="text-muted-foreground">
                {formatHarvestDates(harvestsMap.get(cultivation.b_lu))}
              </span>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
