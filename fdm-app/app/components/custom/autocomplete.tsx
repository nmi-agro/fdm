import type { FieldPathValue, FieldValues, Path, UseFormSetValue } from "react-hook-form"
import { Command as CommandPrimitive } from "cmdk"
import { Check, User, Users, X } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useFetcher } from "react-router"
import { modifySearchParams } from "@/app/lib/url-utils"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "~/components/ui/command"
import { Input } from "~/components/ui/input"
import { Popover, PopoverAnchor, PopoverContent } from "~/components/ui/popover"
import { Spinner } from "~/components/ui/spinner"
import { cn } from "~/lib/utils"

// Stable empty arrays
const EMPTY_EXCLUDE_VALUES: readonly string[] = []

// Expected shape of items returned by the lookup API
type LookupItem<T extends string> = {
  value: T
  label: string
  icon?: string // Icon identifier string (key for iconMap)
}

type IconMap = Record<string, React.ComponentType<{ className?: string }>>

type Props<
  T extends string,
  TFieldValues extends FieldValues = FieldValues,
  TName extends Path<TFieldValues> = Path<TFieldValues>,
> = {
  selectedValue: T | undefined
  onSelectedValueChange: (value: T | undefined) => void
  lookupUrl: string // API endpoint for lookup
  searchParamName?: string // Query parameter name for search term (default: 'identifier')
  excludeValues?: readonly string[] // Optional array of values to filter out
  iconMap?: IconMap // Optional map of icon identifiers to components
  emptyMessage?: string | ((inputValue: string) => React.ReactNode)
  placeholder?: string
  form?: {
    setValue: UseFormSetValue<TFieldValues>
  }
  name?: TName // Name for remix-hook-form registration
  className?: string
  /** When true, values typed directly (not from dropdown) are accepted as-is (e.g. email addresses) */
  allowValuesOutsideList?: boolean
  disabled?: boolean
}

export function AutoComplete<
  T extends string,
  TFieldValues extends FieldValues = FieldValues,
  TName extends Path<TFieldValues> = Path<TFieldValues>,
>({
  selectedValue,
  onSelectedValueChange,
  lookupUrl,
  searchParamName = "identifier", // Default search param name
  excludeValues = EMPTY_EXCLUDE_VALUES,
  iconMap = { user: User, organization: Users }, // Default icon map
  emptyMessage = "No items.",
  placeholder = "Search...",
  form,
  name,
  className,
  allowValuesOutsideList = false,
  disabled = false,
}: Props<T, TFieldValues, TName>) {
  const fetcher = useFetcher<LookupItem<T>[]>()
  const [open, setOpen] = useState(false)
  const openRef = useRef(open)
  // The text the user typed, tagged with the selectedValue it was typed under (pattern C).
  // Falls back to the selected item's label once the tag no longer matches selectedValue.
  const [typed, setTyped] = useState<{ for: T | undefined; text: string } | null>(null)
  // The last input text a fetch was requested for, so we don't refetch for the same term.
  const [lastRequested, setLastRequested] = useState<string | null>(null)
  const debounceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null) // Ref for the input element

  // All items known from the last fetch, regardless of the current input text.
  const rawItems = useMemo(
    () => (fetcher.data ?? []).filter((item) => !excludeValues.includes(item.value)),
    [fetcher.data, excludeValues],
  )

  // Derive display label for the currently selected value.
  // Falls back to selectedValue for free-form entries (when allowValuesOutsideList is true).
  const selectedLabel = useMemo(() => {
    const selectedItem = rawItems.find((item) => item.value === selectedValue)
    return selectedItem?.label ?? (allowValuesOutsideList && selectedValue ? selectedValue : "")
  }, [selectedValue, rawItems, allowValuesOutsideList])

  const inputValue =
    typed !== null && Object.is(typed.for, selectedValue) ? typed.text : selectedLabel
  const items = inputValue ? rawItems : []
  const debouncePending = inputValue.length >= 1 && lastRequested !== inputValue
  const isLoading = fetcher.state !== "idle" || debouncePending

  // Fetch data when the input value changes (debounced)
  useEffect(() => {
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current)
    }

    if (debouncePending) {
      debounceTimeout.current = setTimeout(() => {
        setLastRequested(inputValue)
        const url = modifySearchParams(lookupUrl, (searchParams) => {
          searchParams.set(searchParamName, inputValue)
        })
        void fetcher.load(url) // Use GET request via fetcher.load
      }, 300)
    }

    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current)
      }
    }
  }, [inputValue, debouncePending, lookupUrl, searchParamName, fetcher])

  // Refocus the input once suggestions have finished loading, if it's still open
  useEffect(() => {
    if (fetcher.state === "idle" && open && inputRef.current) {
      // Use setTimeout to ensure focus happens after potential DOM updates
      setTimeout(() => {
        inputRef.current?.focus()
      }, 0)
    }
  }, [fetcher.state, open])

  const handleInputChange = (value: string) => {
    // If user types something different than the selected label, clear the selection
    const clearingSelection = !!selectedValue && value !== selectedLabel
    setTyped({ for: clearingSelection ? undefined : selectedValue, text: value })
    if (clearingSelection) {
      onSelectedValueChange(undefined) // Clear parent state
      if (form && name) {
        form.setValue(name, "" as FieldPathValue<TFieldValues, TName>)
      }
    }
  }

  const handleSelectItem = (itemValue: string) => {
    const selectedItem = items.find((item) => item.value === itemValue)
    if (selectedItem) {
      onSelectedValueChange(selectedItem.value as T)
      setTyped({ for: selectedItem.value as T, text: selectedItem.label })
      setLastRequested(selectedItem.label) // Prevent unnecessary refetch
      if (form && name) {
        form.setValue(name, selectedItem.value as FieldPathValue<TFieldValues, TName>)
      }
    }
    setOpen(false)
    openRef.current = false
  }

  const handleClear = () => {
    onSelectedValueChange(undefined)
    setTyped({ for: undefined, text: "" })
    setLastRequested(null)
    if (form && name) {
      form.setValue(name, undefined as any)
    }
  }

  // Keep input if it matches a valid item, otherwise use typed value as-is (if allowFreeform).
  // Runs synchronously (no setTimeout) so the form value is committed before the submit button
  // click fires. Dropdown item clicks are protected by onMouseDown e.preventDefault() on
  // each CommandItem, which prevents blur from firing during dropdown selection.
  const handleInputBlur = () => {
    if (inputValue && !selectedValue) {
      if (allowValuesOutsideList) {
        // Accept typed value as-is (e.g. email address)
        onSelectedValueChange(inputValue as T)
        setTyped({ for: inputValue as T, text: inputValue })
        if (form && name) {
          form.setValue(name, inputValue as FieldPathValue<TFieldValues, TName>)
        }
      } else {
        // Only dropdown selections allowed — clear the input
        setTyped({ for: selectedValue, text: "" })
      }
    }
    // If input doesn't match selected label, revert input to selected label
    else if (inputValue !== selectedLabel && selectedValue) {
      setTyped({ for: selectedValue, text: selectedLabel })
    }
  }

  return (
    <div className={cn("flex items-center", className)}>
      <Popover
        open={open}
        onOpenChange={(value) => {
          setOpen(value)
          openRef.current = value
        }}
      >
        <Command shouldFilter={false} className="w-full">
          <PopoverAnchor asChild>
            <div className="relative w-full">
              <CommandPrimitive.Input
                asChild
                value={inputValue}
                onValueChange={handleInputChange}
                onKeyDown={(e) => {
                  const next = e.key !== "Escape"
                  setOpen(next)
                  openRef.current = next
                }}
                onMouseDown={() => {
                  const next = !!inputValue || !open
                  setOpen(next)
                  openRef.current = next
                }}
                onFocus={() => {
                  setOpen(true)
                  openRef.current = true
                }}
                onBlur={handleInputBlur}
              >
                <Input
                  ref={inputRef}
                  placeholder={placeholder}
                  className={cn("w-full", selectedValue && !allowValuesOutsideList && "pr-8")}
                  autoComplete="off"
                  disabled={disabled}
                />
              </CommandPrimitive.Input>
              {selectedValue && !allowValuesOutsideList && (
                <button
                  type="button"
                  aria-label="Wis selectie"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    handleClear()
                  }}
                  className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </PopoverAnchor>
          {!open && <CommandList aria-hidden="true" className="hidden" />}
          <PopoverContent
            asChild
            onOpenAutoFocus={(e) => e.preventDefault()}
            onInteractOutside={(e) => {
              if (e.target instanceof Element && e.target.hasAttribute("cmdk-input")) {
                e.preventDefault()
              }
            }}
            className="w-(--radix-popover-trigger-width) p-0"
          >
            <CommandList>
              {isLoading && (
                <CommandPrimitive.Loading>
                  <div className="p-1">
                    <Spinner className="h-6 w-full" />
                  </div>
                </CommandPrimitive.Loading>
              )}
              {items.length > 0 && !isLoading ? (
                <CommandGroup>
                  {items.map((option) => {
                    // Use iconMap to get the component, default to Check
                    const IconComponent = option.icon ? (iconMap[option.icon] ?? Check) : Check
                    return (
                      <CommandItem
                        key={option.value}
                        value={option.value} // Use value for selection logic
                        onMouseDown={(e) => e.preventDefault()} // Prevent blur on click
                        onSelect={() => handleSelectItem(option.value)}
                      >
                        <IconComponent className={"mr-2 h-4 w-4"} />
                        {option.label}
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              ) : null}
              {!isLoading && !items.length && inputValue ? ( // Show empty only if not loading and user typed something
                <CommandEmpty>
                  {typeof emptyMessage === "function" ? emptyMessage(inputValue) : emptyMessage}
                </CommandEmpty>
              ) : null}
            </CommandList>
          </PopoverContent>
        </Command>
      </Popover>
      {name && <input type="hidden" name={name} value={selectedValue ?? ""} readOnly />}
    </div>
  )
}
