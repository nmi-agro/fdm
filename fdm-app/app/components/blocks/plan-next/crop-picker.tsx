import { Check, ChevronsUpDown } from "lucide-react"
import { useState } from "react"
import { Button } from "~/components/ui/button"
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

/** A cultivation that can be chosen. */
export type CropOption = { value: string; label: string }

/**
 * Searchable cultivation picker for a plain form: the chosen catalogue code is submitted as a
 * hidden input with the given name.
 */
export function CropPicker({
  name,
  options,
  defaultValue,
  disabled,
  placeholder = "Kies een gewas",
}: {
  name: string
  options: CropOption[]
  defaultValue?: string | null
  disabled?: boolean
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(defaultValue ?? "")
  const label = options.find((option) => option.value === value)?.label

  return (
    <>
      <input type="hidden" name={name} value={value} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full min-w-48 justify-between truncate"
          >
            <span key={value} className={cn("truncate", label ? "" : "text-muted-foreground")}>
              {label ?? placeholder}
            </span>
            <ChevronsUpDown className="opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0">
          <Command>
            <CommandInput placeholder="Begin met typen..." className="h-9" />
            <CommandList>
              <CommandEmpty>Niks gevonden</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    onSelect={() => {
                      setValue(option.value)
                      setOpen(false)
                    }}
                  >
                    <span className="text-pretty">{option.label}</span>
                    <Check
                      className={cn(
                        "ml-auto",
                        option.value === value ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  )
}
