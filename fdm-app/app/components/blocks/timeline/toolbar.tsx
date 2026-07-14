import { Filter } from "lucide-react"
import type { TimelineFilters } from "~/components/blocks/timeline/gantt-view"
import type { Range } from "~/components/kibo-ui/gantt"
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
}: {
  range: Range
  onRangeChange: (range: Range) => void
  filters: TimelineFilters
  onFiltersChange: (filters: TimelineFilters) => void
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

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline">
            <Filter className="size-4" />
            Filters
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 space-y-4">
          <div className="space-y-2">
            <p className="text-muted-foreground text-xs font-medium">Gebeurtenissen</p>
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
              <Label htmlFor="filter-soil">Bodemmonsters</Label>
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
