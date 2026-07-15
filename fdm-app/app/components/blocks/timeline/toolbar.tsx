import { Eye, Locate } from "lucide-react"
import type { TimelineFilters } from "~/components/blocks/timeline/gantt-view"
import type { Range } from "~/components/kibo-ui/gantt"
import { TimelineFiltersPopover } from "~/components/blocks/timeline/timeline-filters"
import { Button } from "~/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"

const rangeLabels: Record<Range, string> = {
  daily: "Dagelijks",
  monthly: "Maandelijks",
  quarterly: "Kwartaal",
}

export function TimelineToolbar({
  range,
  onRangeChange,
  filters,
  onFiltersChange,
  onJumpToToday,
}: {
  range: Range
  onRangeChange: (range: Range) => void
  filters: TimelineFilters
  onFiltersChange: (filters: TimelineFilters) => void
  onJumpToToday: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select onValueChange={(value) => onRangeChange(value as Range)} value={range}>
        <SelectTrigger className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(rangeLabels) as Range[]).map((key) => (
            <SelectItem key={key} value={key}>
              {rangeLabels[key]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button onClick={onJumpToToday} variant="outline">
        <Locate className="size-4" />
        Vandaag
      </Button>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline">
            <Eye className="size-4" />
            Weergave
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
        <PopoverContent align="end" className="w-64 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-xs font-medium">Zichtbare onderdelen</p>
            {activeFilterCount > 0 && (
              <Button
                className="h-auto p-0 text-xs"
                onClick={() => onFiltersChange(defaultFilters)}
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
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
