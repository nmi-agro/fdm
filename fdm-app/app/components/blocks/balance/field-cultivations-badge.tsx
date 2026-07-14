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

interface FieldCultivationsBadgeProps {
  cultivations: Cultivation[]
  /**
   * The field's main cultivation ('hoofdteelt') for the year, computed server-side
   * via `getDefaultCultivation` so the label matches the value used in calculations.
   * The calculator that determines this cannot run in client bundles, so it is
   * passed in as a prop rather than recomputed here.
   */
  mainCultivation: Cultivation | null
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
  mainCultivation,
  harvestsMap,
  fieldName,
}: FieldCultivationsBadgeProps) {
  if (cultivations.length === 0) return null
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
          className="flex cursor-pointer items-center gap-1"
          aria-label={`Bekijk teelten voor ${fieldName}`}
        >
          <Badge
            variant="default"
            className="shrink-0 text-xs font-normal text-white"
            style={{
              backgroundColor: color,
            }}
          >
            {mainCultivation.b_lu_name ?? "Onbekend"}
          </Badge>
          {extraCount > 0 && (
            <span className="text-muted-foreground text-xs font-medium whitespace-nowrap">
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
          <div className="text-muted-foreground grid grid-cols-4 gap-2 border-b pb-2 text-xs font-semibold">
            <span>Gewas</span>
            <span>Start</span>
            <span>Einde</span>
            <span>Oogst</span>
          </div>
          {/* Cultivation rows */}
          {sortedCultivations.map((cultivation) => (
            <div key={cultivation.b_lu} className="grid grid-cols-4 items-start gap-2 text-sm">
              <span className="truncate font-medium">
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
