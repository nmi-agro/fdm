import { Check, ChevronDown } from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router"
import { useSelectedFieldStore } from "@/app/store/selected-field"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover"
import { cn } from "~/lib/utils"

export type HeaderFieldPickerOption = {
  b_id: string
  b_name: string | undefined | null
  b_area?: number
}

/**
 * Searchable field-switcher used in page headers: a popover with a search input, an "Onlangs
 * bezocht" group (from the recently-visited fields store) and an "Alle percelen" group. Shared
 * across every header that lets the user jump between fields (field pages, nutrient advice,
 * balance, norms, indicators, measures) so the switching UX is consistent everywhere.
 */
export function HeaderFieldPicker({
  b_id,
  fieldOptions,
  buildHref,
  placeholder = "Kies een perceel",
  triggerClassName,
}: {
  b_id: string | undefined
  fieldOptions: HeaderFieldPickerOption[]
  buildHref: (b_id: string) => string
  placeholder?: string
  triggerClassName?: string
}) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const { recentFieldIds, setSelectedField } = useSelectedFieldStore()

  const handleSelect = (optionId: string, optionName: string) => {
    setOpen(false)
    setSelectedField(optionId, optionName)
    void navigate(buildHref(optionId))
  }

  // LRU order: iterate recentFieldIds so most-recent-first is preserved
  const recentFields = recentFieldIds
    .map((id) => fieldOptions.find((f) => f.b_id === id))
    .filter((f): f is NonNullable<typeof f> => f !== undefined)
  const regularFields = fieldOptions
    .filter((f) => !recentFieldIds.includes(f.b_id))
    .sort(
      (a, b) =>
        (b.b_area ?? 0) - (a.b_area ?? 0) ||
        (a.b_name ?? "").localeCompare(b.b_name ?? ""),
    )

  const selectedLabel = b_id
    ? (fieldOptions.find((option) => option.b_id === b_id)?.b_name ?? "Onbekend perceel")
    : placeholder

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          "flex max-w-[120px] cursor-pointer items-center gap-1 outline-none sm:max-w-[200px] md:max-w-none",
          triggerClassName,
        )}
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown className="text-muted-foreground h-4 w-4 shrink-0" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[280px] p-0">
        <Command>
          <CommandInput
            placeholder="Zoek perceel..."
            className="border-none focus:ring-0 focus-visible:ring-0"
          />
          <CommandList className="max-h-[300px] overflow-y-auto">
            <CommandEmpty>Geen percelen gevonden.</CommandEmpty>
            {recentFields.length > 0 && (
              <CommandGroup heading="Onlangs bezocht">
                {recentFields.map((option) => (
                  <CommandItem
                    key={`header-recent-${option.b_id}`}
                    value={`${option.b_name ?? ""} ${option.b_id}`}
                    onSelect={() => handleSelect(option.b_id, option.b_name ?? "")}
                    className="flex cursor-pointer items-center justify-between"
                  >
                    <span>{option.b_name}</span>
                    <div className="ml-auto flex items-center gap-2">
                      {option.b_area != null && (
                        <span className="text-muted-foreground text-xs">{option.b_area} ha</span>
                      )}
                      {b_id === option.b_id && (
                        <Check className="text-primary h-4 w-4 shrink-0" />
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {regularFields.length > 0 && (
              <CommandGroup heading="Alle percelen">
                {regularFields.map((option) => (
                  <CommandItem
                    key={option.b_id}
                    value={`${option.b_name ?? ""} ${option.b_id}`}
                    onSelect={() => handleSelect(option.b_id, option.b_name ?? "")}
                    className="flex cursor-pointer items-center justify-between"
                  >
                    <span>{option.b_name}</span>
                    <div className="ml-auto flex items-center gap-2">
                      {option.b_area != null && (
                        <span className="text-muted-foreground text-xs">{option.b_area} ha</span>
                      )}
                      {b_id === option.b_id && (
                        <Check className="text-primary h-4 w-4 shrink-0" />
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
