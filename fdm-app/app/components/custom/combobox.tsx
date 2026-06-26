import { Check, ChevronsUpDown } from "lucide-react"
import { type ReactNode, useMemo, useState } from "react"
import type { Control, FieldPathValue, FieldValues, Path, UseFormSetValue } from "react-hook-form"
import { Button } from "~/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command"
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form"
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover"
import { cn } from "~/lib/utils"

type optionType = {
  value: string
  label: string
}

interface ComboboxProps<TFieldValues extends FieldValues, TName extends Path<TFieldValues>> {
  options: optionType[]
  name: TName
  label: ReactNode
  form: {
    control: Control<TFieldValues, any, any>
    setValue: UseFormSetValue<TFieldValues>
  }
  defaultValue?: optionType["value"]
  disabled?: boolean
}

export function Combobox<TFieldValues extends FieldValues, TName extends Path<TFieldValues>>({
  options,
  name,
  label,
  form,
  defaultValue,
  disabled,
}: ComboboxProps<TFieldValues, TName>) {
  const [open, setOpen] = useState(false)

  /** Map of option values to their labels for efficient lookup */
  const optionsMap = useMemo(
    () =>
      new Map(
        options.map((option: { value: string; label: string }) => [option.value, option.label]),
      ),
    [options],
  )

  /** Computed label for the default value if provided */
  const defaultLabel = useMemo(
    () => (defaultValue ? optionsMap.get(defaultValue) : undefined),
    [defaultValue, optionsMap],
  )

  return (
    <FormField
      control={form.control as Control<FieldValues, any, any>}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <FormControl>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  name={name}
                  disabled={disabled}
                  className="w-full justify-between truncate focus-visible:ring-2"
                  aria-label={`Selecteer ${
                    options.find((option) => option.value === field.value)?.label ||
                    defaultLabel ||
                    "Klik om te begin met typen..."
                  }`}
                  aria-controls="combobox-options"
                  aria-haspopup="listbox"
                >
                  {options.find((option) => option.value === field.value)?.label ||
                    defaultLabel ||
                    "Begin met typen..."}
                  <ChevronsUpDown className="opacity-50" />
                </Button>
              </FormControl>
            </PopoverTrigger>
            <PopoverContent id="combobox-options" className="w-full p-0">
              <Command>
                <CommandInput placeholder="Begin met typen..." className="h-9" />
                <CommandList>
                  <CommandEmpty>Niks gevonden</CommandEmpty>
                  <CommandGroup>
                    {options.map((option: optionType) => (
                      <CommandItem
                        value={option.label}
                        key={option.value}
                        disabled={disabled}
                        onSelect={(_value) => {
                          form.setValue(name, option.value as FieldPathValue<TFieldValues, TName>)
                          setOpen(false)
                        }}
                      >
                        <p className="text-pretty w-[350px]">{option.label}</p>
                        <Check
                          className={cn(
                            "ml-auto",
                            option.value === field.value ? "opacity-100" : "opacity-0",
                          )}
                        />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <FormDescription />
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
