import { Check, ChevronDown } from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router"
import { useSelectedFieldStore } from "@/app/store/selected-field"
import { getCultivationColor } from "~/components/custom/cultivation-colors"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip"
import { cn } from "~/lib/utils"

export type HeaderFieldPickerOption = {
  b_id: string
  b_name?: string | null
  b_area?: number
  b_lu_name?: string
  b_lu_croprotation?: string
}

export function FieldPickerItem({
  option,
  isSelected,
  onSelect,
  keyPrefix,
}: {
  option: HeaderFieldPickerOption
  isSelected?: boolean
  onSelect: (b_id: string, b_name: string) => void
  keyPrefix?: string
}) {
  const content = (
    <div className="flex w-full min-w-0 items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        {option.b_lu_name ? (
          <>
            <span
              className="size-2 shrink-0 rounded-full"
              style={{
                backgroundColor: getCultivationColor(option.b_lu_croprotation),
              }}
              aria-hidden="true"
            />
            <span className="sr-only">Gewas: {option.b_lu_name}</span>
          </>
        ) : null}
        <span className="truncate">{option.b_name}</span>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        {option.b_area != null && (
          <span className="text-muted-foreground text-xs">{option.b_area} ha</span>
        )}
        {isSelected && <Check className="text-primary h-4 w-4 shrink-0" />}
      </div>
    </div>
  )

  const accessibleName = option.b_lu_name
    ? `${option.b_name ?? ""}, gewas ${option.b_lu_name}`
    : (option.b_name ?? "")

  return (
    <CommandItem
      key={keyPrefix ? `${keyPrefix}-${option.b_id}` : option.b_id}
      value={`${option.b_name ?? ""} ${option.b_id}`}
      aria-label={accessibleName}
      onSelect={() => onSelect(option.b_id, option.b_name ?? "")}
      className="flex cursor-pointer items-center justify-between"
    >
      {option.b_lu_name ? (
        <Tooltip>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent side="top">
            <p>{option.b_lu_name}</p>
          </TooltipContent>
        </Tooltip>
      ) : (
        content
      )}
    </CommandItem>
  )
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
    <TooltipProvider>
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
                    <FieldPickerItem
                      key={`header-recent-${option.b_id}`}
                      keyPrefix="header-recent"
                      option={option}
                      isSelected={b_id === option.b_id}
                      onSelect={handleSelect}
                    />
                  ))}
                </CommandGroup>
              )}
              {regularFields.length > 0 && (
                <CommandGroup heading="Alle percelen">
                  {regularFields.map((option) => (
                    <FieldPickerItem
                      key={option.b_id}
                      option={option}
                      isSelected={b_id === option.b_id}
                      onSelect={handleSelect}
                    />
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </TooltipProvider>
  )
}
