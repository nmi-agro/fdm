import { Filter } from "lucide-react"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Checkbox } from "~/components/ui/checkbox"
import { Label } from "~/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import type { TimelineFilters } from "./gantt-view"

// Radix's Select.Item doesn't support an empty string as its value (that's reserved internally
// for "no selection"), so the "show everything" period option — which is modeled as value ""
// everywhere else in the timeline — needs a non-empty stand-in only at this Select boundary.
const ALL_PERIOD_VALUE = "__all__"

export const defaultTimelineFilters: TimelineFilters = {
  showBufferStrips: false,
  showCultivations: true,
  showFertilizers: true,
  showHarvests: true,
  showSoilSamplings: true,
  showFutureEvents: false,
}

export function countActiveTimelineFilters(filters: TimelineFilters): number {
  return Object.entries(filters).filter(
    ([key, value]) => value !== defaultTimelineFilters[key as keyof TimelineFilters],
  ).length
}

export function TimelineFiltersPopover({
  filters,
  onFiltersChange,
  align = "end",
  period,
}: {
  filters: TimelineFilters
  onFiltersChange: (filters: TimelineFilters) => void
  align?: "start" | "center" | "end"
  period?: {
    value: string
    options: { value: string; label: string }[]
    onChange: (value: string) => void
  }
}) {
  const activeFilterCount = countActiveTimelineFilters(filters)
  const periodLabel = period?.options.find((option) => option.value === period.value)?.label
  const isPeriodFiltered = Boolean(period && period.value !== "")

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="lg" variant="outline">
          <Filter className="size-4" />
          {isPeriodFiltered ? periodLabel : "Filters"}
          {activeFilterCount > 0 && (
            <Badge
              className="motion-safe:animate-in motion-safe:zoom-in-50 ml-1 px-1.5 motion-safe:duration-200 motion-safe:ease-out"
              key={activeFilterCount}
              variant="secondary"
            >
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-64 space-y-4">
        {period && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground text-xs font-medium">Periode</p>
              {isPeriodFiltered && (
                <Button
                  className="h-auto p-0 text-xs"
                  onClick={() => period.onChange("")}
                  variant="link"
                >
                  Alles tonen
                </Button>
              )}
            </div>
            <Select
              onValueChange={(value) => period.onChange(value === ALL_PERIOD_VALUE ? "" : value)}
              value={period.value === "" ? ALL_PERIOD_VALUE : period.value}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {period.options.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value === "" ? ALL_PERIOD_VALUE : option.value}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className={period ? "space-y-2 border-t pt-3" : "space-y-2"}>
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-xs font-medium">Actieve filters</p>
            {activeFilterCount > 0 && (
              <Button
                className="h-auto p-0 text-xs"
                onClick={() => onFiltersChange(defaultTimelineFilters)}
                variant="link"
              >
                Standaard herstellen
              </Button>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={filters.showCultivations}
                id="filter-cultivations"
                onCheckedChange={(checked) =>
                  onFiltersChange({ ...filters, showCultivations: checked === true })
                }
              />
              <Label htmlFor="filter-cultivations">Gewassen</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={filters.showFertilizers}
                id="filter-fertilizers"
                onCheckedChange={(checked) =>
                  onFiltersChange({ ...filters, showFertilizers: checked === true })
                }
              />
              <Label htmlFor="filter-fertilizers">Bemesting</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={filters.showHarvests}
                id="filter-harvests"
                onCheckedChange={(checked) =>
                  onFiltersChange({ ...filters, showHarvests: checked === true })
                }
              />
              <Label htmlFor="filter-harvests">Oogst</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={filters.showSoilSamplings}
                id="filter-soil"
                onCheckedChange={(checked) =>
                  onFiltersChange({ ...filters, showSoilSamplings: checked === true })
                }
              />
              <Label htmlFor="filter-soil">Bodemanalyses</Label>
            </div>
          </div>
        </div>
        <div className="space-y-2 border-t pt-3">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={filters.showBufferStrips}
              id="filter-bufferstrips"
              onCheckedChange={(checked) =>
                onFiltersChange({ ...filters, showBufferStrips: checked === true })
              }
            />
            <Label htmlFor="filter-bufferstrips">Toon bufferstroken</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={filters.showFutureEvents}
              id="filter-future-events"
              onCheckedChange={(checked) =>
                onFiltersChange({ ...filters, showFutureEvents: checked === true })
              }
            />
            <Label htmlFor="filter-future-events">Toon toekomstige gebeurtenissen</Label>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
