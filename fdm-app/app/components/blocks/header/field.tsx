import { ChevronDown, Check } from "lucide-react"
import { useState } from "react"
import { useNavigate, useLocation } from "react-router"
import { cn } from "@/app/lib/utils"
import { useCalendarStore } from "@/app/store/calendar"
import { useSelectedFieldStore } from "@/app/store/selected-field"
import { BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator } from "~/components/ui/breadcrumb"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover"

export function HeaderField({
  b_id_farm,
  b_id,
  fieldOptions,
  compact,
}: {
  b_id_farm: string
  b_id: string | undefined
  fieldOptions: HeaderFieldOption[]
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const currentPath = String(location.pathname)
  const calendar = useCalendarStore((state) => state.calendar)
  const { recentFieldIds, setSelectedField } = useSelectedFieldStore()

  const handleSelect = (optionId: string, optionName: string) => {
    setOpen(false)
    setSelectedField(optionId, optionName)
    const targetUrl = currentPath.includes("/cultivation")
      ? `/farm/${b_id_farm}/${calendar}/field/${optionId}/cultivation`
      : b_id
        ? currentPath.replace(`/field/${b_id}`, `/field/${optionId}`)
        : `/farm/${b_id_farm}/${calendar}/field/${optionId}/overview`
    void navigate(targetUrl)
  }

  // LRU order: iterate recentFieldIds so most-recent-first is preserved
  const recentFields = recentFieldIds
    .map((id) => fieldOptions.find((f) => f.b_id === id))
    .filter((f): f is NonNullable<typeof f> => f !== undefined)
  const regularFields = fieldOptions.filter((f) => !recentFieldIds.includes(f.b_id))

  return (
    <>
      <BreadcrumbSeparator className="hidden xl:block" />
      <BreadcrumbItem className={cn("hidden", !compact && "xl:block")}>
        <BreadcrumbLink href={`/farm/${b_id_farm}/${calendar}/field`}>Perceel</BreadcrumbLink>
      </BreadcrumbItem>
      {fieldOptions.length > 0 ? (
        <>
          <BreadcrumbSeparator className={cn("hidden", !compact && "xl:block")} />
          <BreadcrumbItem>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger className="flex max-w-[120px] cursor-pointer items-center gap-1 outline-none sm:max-w-[200px] md:max-w-none">
                <span className="truncate">
                  {b_id && fieldOptions
                    ? (fieldOptions.find((option) => option.b_id === b_id)?.b_name ??
                      "Unknown field")
                    : "Kies een perceel"}
                </span>
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
                            value={option.b_name ?? ""}
                            onSelect={() => handleSelect(option.b_id, option.b_name ?? "")}
                            className="flex cursor-pointer items-center justify-between"
                          >
                            <span>{option.b_name}</span>
                            {b_id === option.b_id && (
                              <Check className="text-primary ml-auto h-4 w-4 shrink-0" />
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                    {regularFields.length > 0 && (
                    <CommandGroup heading="Alle percelen">
                      {regularFields.map((option) => (
                        <CommandItem
                          key={option.b_id}
                          value={option.b_name ?? ""}
                          onSelect={() => handleSelect(option.b_id, option.b_name ?? "")}
                          className="flex cursor-pointer items-center justify-between"
                        >
                          <span>{option.b_name}</span>
                          {b_id === option.b_id && (
                            <Check className="text-primary ml-auto h-4 w-4 shrink-0" />
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </BreadcrumbItem>
        </>
      ) : (
        <>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href={`/farm/${b_id_farm}/${calendar}/field/new`}>
              Nieuwe perceel
            </BreadcrumbLink>
          </BreadcrumbItem>
        </>
      )}
    </>
  )
}

type HeaderFieldOption = {
  b_id: string
  b_name: string | undefined | null
}
