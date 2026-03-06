import * as chrono from "chrono-node"
import { format } from "date-fns"
import { nl } from "date-fns/locale"
import { CalendarIcon } from "lucide-react"
import React from "react"
import type { FieldValues, Path, UseFormReturn } from "react-hook-form"
import { Button } from "~/components/ui/button"
import { Calendar } from "~/components/ui/calendar"
import {
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "~/components/ui/form"
import { Input } from "~/components/ui/input"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "~/components/ui/popover"

import { endMonth } from "~/lib/calendar"

function parseDateString(dateString: string): Date | undefined {
    if (!dateString) {
        return undefined
    }

    // Attempt to parse using chrono-node (Dutch)
    const referenceDate = new Date()
    const parsedDate = chrono.nl.parseDate(dateString, referenceDate)
    if (parsedDate) {
        return parsedDate
    }

    // Fallback to default Date parsing for other formats
    const defaultDate = new Date(dateString)
    return isValidDate(defaultDate) ? defaultDate : undefined
}

function formatDate(date: Date | undefined) {
    if (!date) {
        return ""
    }

    return format(date, "d MMMM yyyy", { locale: nl })
}

function isValidDate(date: Date | undefined) {
    if (!date) {
        return false
    }
    return !Number.isNaN(date.getTime())
}

interface DatePickerProps<TFieldValues extends FieldValues> {
    form: UseFormReturn<TFieldValues>
    name: Path<TFieldValues> // Use Path for better type inference with react-hook-form
    label: string
    description: string
    disabled: boolean
}

export function DatePicker<TFieldValues extends FieldValues>({
    form,
    name,
    label,
    description,
    disabled = false,
}: DatePickerProps<TFieldValues>) {
    const [open, setOpen] = React.useState(false)
    const [date, setDate] = React.useState<Date | undefined>(
        form.getValues(name),
    )
    const [month, setMonth] = React.useState<Date>(date || new Date()) // Initialize month to current date if 'date' is undefined
    const [value, setValue] = React.useState(formatDate(date))
    const [isInputValid, setIsInputValid] = React.useState(true)

    React.useEffect(() => {
        const formDate: unknown = form.getValues(name) // Explicitly type as unknown
        // Check if formDate is a valid Date object before using it
        if (formDate instanceof Date && isValidDate(formDate)) {
            if (formDate.getTime() !== date?.getTime()) {
                setDate(formDate)
                setMonth(formDate) // Set month to the selected date
                setValue(formatDate(formDate))
                setIsInputValid(true)
            }
        } else if (date !== undefined) {
            // If formDate is undefined or invalid, and date was previously defined
            setDate(undefined)
            setMonth(new Date()) // Reset month to current month
            setValue("") // Clear input value
            setIsInputValid(true)
        }
    }, [form, name, date])

    React.useEffect(() => {
        if (disabled && open) {
            setOpen(false)
        }
    }, [disabled, open])

    return (
        <FormField
            control={form.control}
            name={name}
            render={({ field }) => (
                <FormItem className="flex flex-col">
                    <FormLabel>{label}</FormLabel>
                    <div className="relative flex gap-2">
                        <FormControl>
                            <Input
                                id={field.name}
                                value={value}
                                placeholder="Kies een datum"
                                className="bg-background pr-10"
                                disabled={disabled}
                                onChange={(e) => setValue(e.target.value)}
                                onBlur={(e) => {
                                    const text = e.target.value
                                    if (text.trim() === "") {
                                        setDate(undefined)
                                        setValue("")
                                        field.onChange(undefined)
                                        setIsInputValid(true)
                                        field.onBlur()
                                        return
                                    }

                                    const newDate = parseDateString(text)
                                    if (newDate && isValidDate(newDate)) {
                                        setDate(newDate)
                                        setMonth(newDate)
                                        setValue(formatDate(newDate))
                                        field.onChange(newDate)
                                        setIsInputValid(true)
                                    } else {
                                        setIsInputValid(false)
                                        field.onChange(undefined)
                                    }
                                    field.onBlur()
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault()
                                        e.currentTarget.blur()
                                    }
                                    if (e.key === "ArrowDown") {
                                        e.preventDefault()
                                        setOpen(true)
                                    }
                                }}
                            />
                        </FormControl>
                        <Popover open={open} onOpenChange={setOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    id={`${field.name}-picker`}
                                    variant="ghost"
                                    className="absolute top-1/2 right-2 size-6 -translate-y-1/2"
                                    disabled={disabled}
                                >
                                    <CalendarIcon className="size-3.5" />
                                    <span className="sr-only">
                                        Kies een datum
                                    </span>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent
                                className="w-auto overflow-hidden p-0"
                                align="end"
                                alignOffset={-8}
                                sideOffset={10}
                            >
                                <Calendar
                                    mode="single"
                                    selected={date}
                                    captionLayout="dropdown"
                                    month={month}
                                    onMonthChange={setMonth}
                                    onSelect={(selectedDate) => {
                                        setDate(selectedDate)
                                        setValue(formatDate(selectedDate))
                                        field.onChange(selectedDate)
                                        setOpen(false)
                                        setIsInputValid(true) // Set valid on calendar select
                                    }}
                                    startMonth={new Date(1970, 0)}
                                    endMonth={endMonth}
                                    locale={nl}
                                    className="rounded-lg border shadow-sm"
                                />
                            </PopoverContent>
                        </Popover>
                    </div>
                    <FormDescription>{description}</FormDescription>
                    <FormMessage>
                        {!isInputValid ? "Ongeldige datum" : null}
                    </FormMessage>
                </FormItem>
            )}
        />
    )
}
