import { Command as CommandPrimitive } from "cmdk"
import { Check, User, Users } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useFetcher } from "react-router-dom"
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

// Expected shape of items returned by the lookup API
type LookupItem<T extends string> = {
    value: T
    label: string
    icon?: string // Icon identifier string (key for iconMap)
}

type IconMap = Record<string, React.ComponentType<{ className?: string }>>

type Props<T extends string> = {
    selectedValue: T
    onSelectedValueChange: (value: T) => void
    lookupUrl: string // API endpoint for lookup
    searchParamName?: string // Query parameter name for search term (default: 'identifier')
    excludeValues?: T[] // Optional array of values to filter out
    iconMap?: IconMap // Optional map of icon identifiers to components
    emptyMessage?: string | ((inputValue: string) => React.ReactNode)
    placeholder?: string
    // biome-ignore lint/suspicious/noExplicitAny: Using any temporarily due to potential type conflicts with remix-hook-form
    form?: any
    name?: string // Name for remix-hook-form registration
    className?: string
    /** When true, values typed directly (not from dropdown) are accepted as-is (e.g. email addresses) */
    allowValuesOutsideList?: boolean
    disabled?: boolean
}

export function AutoComplete<T extends string>({
    selectedValue,
    onSelectedValueChange,
    lookupUrl,
    searchParamName = "identifier", // Default search param name
    excludeValues = [],
    iconMap = { user: User, organization: Users }, // Default icon map
    emptyMessage = "No items.",
    placeholder = "Search...",
    form,
    name,
    className,
    allowValuesOutsideList = false,
    disabled = false,
}: Props<T>) {
    const fetcher = useFetcher<LookupItem<T>[]>()
    const [open, setOpen] = useState(false)
    const openRef = useRef(open)
    const [inputValue, setInputValue] = useState("") // Internal input state
    const [items, setItems] = useState<LookupItem<T>[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const debounceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
    const prevInputValue = useRef<string | null>(null)
    const inputRef = useRef<HTMLInputElement>(null) // Ref for the input element

    // Derive display label for the currently selected value.
    // Falls back to selectedValue for free-form entries (when allowValuesOutsideList is true).
    const selectedLabel = useMemo(() => {
        const selectedItem = items.find((item) => item.value === selectedValue)
        return selectedItem?.label ?? (allowValuesOutsideList ? selectedValue : "")
    }, [selectedValue, items, allowValuesOutsideList])

    // Effect to fetch data when input value changes (debounced)
    useEffect(() => {
        if (debounceTimeout.current) {
            clearTimeout(debounceTimeout.current)
        }

        // Only fetch if input has changed and is not empty
        if (inputValue.length >= 1 && prevInputValue.current !== inputValue) {
            debounceTimeout.current = setTimeout(() => {
                prevInputValue.current = inputValue
                setIsLoading(true)
                const url = `${lookupUrl}?${searchParamName}=${encodeURIComponent(inputValue)}`
                fetcher.load(url) // Use GET request via fetcher.load
            }, 300)
        } else if (inputValue.length < 1) {
            setItems([]) // Clear items if input is empty
            setIsLoading(false)
        }

        return () => {
            if (debounceTimeout.current) {
                clearTimeout(debounceTimeout.current)
            }
        }
    }, [inputValue, lookupUrl, searchParamName, fetcher])

    // Effect to process fetched data
    useEffect(() => {
        if (fetcher.data) {
            const filteredItems = fetcher.data.filter(
                (item) => !excludeValues.includes(item.value),
            )
            setItems(filteredItems)
        }
        // Stop loading regardless of data presence, but only if fetcher is idle
        if (fetcher.state === "idle") {
            setIsLoading(false)
            // Refocus the input if it's still open after loading suggestions
            // Use setTimeout to ensure focus happens after potential DOM updates
            if (open && inputRef.current) {
                setTimeout(() => {
                    inputRef.current?.focus()
                }, 0)
            }
        }
    }, [fetcher.data, fetcher.state, excludeValues, open])

    // Effect to sync input field when selectedValue changes externally
    useEffect(() => {
        // If a value is selected externally, update the input field to its label
        // This handles cases where the form is reset or pre-populated
        if (selectedValue && selectedLabel) {
            setInputValue(selectedLabel)
        } else if (!selectedValue) {
            // If selectedValue is cleared externally, clear the input
            setInputValue("")
        }
        // We only want this effect to run when selectedValue changes externally,
        // not when selectedLabel changes due to items loading.
    }, [selectedValue, selectedLabel])

    const handleInputChange = (value: string) => {
        setInputValue(value)
        // If user types something different than the selected label, clear the selection
        if (selectedValue && value !== selectedLabel) {
            onSelectedValueChange("" as T) // Clear parent state
            if (form && name) {
                form.setValue(name, "") // Clear form state if applicable
            }
        }
    }

    const handleSelectItem = (itemValue: string) => {
        const selectedItem = items.find((item) => item.value === itemValue)
        if (selectedItem) {
            onSelectedValueChange(selectedItem.value as T)
            setInputValue(selectedItem.label) // Update input to reflect selection
            prevInputValue.current = selectedItem.label // Update previous input value to prevent unnecessary fetch
            if (form && name) {
                form.setValue(name, selectedItem.value) // Update form state
            }
        }
        setOpen(false)
        openRef.current = false
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
                if (form && name) {
                    form.setValue(name, inputValue)
                }
            } else {
                // Only dropdown selections allowed — clear the input
                setInputValue("")
            }
        }
        // If input doesn't match selected label, revert input to selected label
        else if (inputValue !== selectedLabel && selectedValue) {
            setInputValue(selectedLabel)
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
                                ref={inputRef} // Assign ref to the input
                                placeholder={placeholder}
                                className="w-full"
                                autoComplete="off" // Prevent browser autocomplete
                                disabled={disabled}
                            />
                        </CommandPrimitive.Input>
                    </PopoverAnchor>
                    {!open && (
                        <CommandList aria-hidden="true" className="hidden" />
                    )}
                    <PopoverContent
                        asChild
                        onOpenAutoFocus={(e) => e.preventDefault()}
                        onInteractOutside={(e) => {
                            if (
                                e.target instanceof Element &&
                                e.target.hasAttribute("cmdk-input")
                            ) {
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
                                        const IconComponent = option.icon
                                            ? (iconMap[option.icon] ?? Check)
                                            : Check
                                        return (
                                            <CommandItem
                                                key={option.value}
                                                value={option.value} // Use value for selection logic
                                                onMouseDown={(e) =>
                                                    e.preventDefault()
                                                } // Prevent blur on click
                                                onSelect={() =>
                                                    handleSelectItem(
                                                        option.value,
                                                    )
                                                }
                                            >
                                                <IconComponent
                                                    className={"mr-2 h-4 w-4"}
                                                />
                                                {option.label}
                                            </CommandItem>
                                        )
                                    })}
                                </CommandGroup>
                            ) : null}
                            {!isLoading && !items.length && inputValue ? ( // Show empty only if not loading and user typed something
                                <CommandEmpty>
                                    {typeof emptyMessage === "function"
                                        ? emptyMessage(inputValue)
                                        : emptyMessage}
                                </CommandEmpty>
                            ) : null}
                        </CommandList>
                    </PopoverContent>
                </Command>
            </Popover>
            {/* Hidden input for react-hook-form integration */}
            {form && name && (
                <input
                    type="hidden"
                    {...form.register(name)}
                    defaultValue={selectedValue}
                />
            )}
        </div>
    )
}
