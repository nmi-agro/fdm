"use client"

import * as chrono from "chrono-node"
import { format } from "date-fns"
import { nl } from "date-fns/locale"
import { CalendarIcon } from "lucide-react"
import { type ChangeEvent, useEffect, useState } from "react"
import { nl as calenderLocale } from "react-day-picker/locale"
import type {
    ControllerFieldState,
    ControllerRenderProps,
    FieldValues,
} from "react-hook-form"
import { Button } from "~/components/ui/button"
import { Calendar } from "~/components/ui/calendar"
import {
    Field,
    FieldDescription,
    FieldError,
    FieldLabel,
} from "~/components/ui/field"
import { Input } from "~/components/ui/input"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "~/components/ui/popover"
import { endMonth } from "~/lib/calendar"
import { cn } from "~/lib/utils"
import { useCalendarStore } from "~/store/calendar"

type DatePickerProps = {
    label: string | undefined
    description?: string
    placeholder?: string
    defaultValue?: Date
    field: ControllerRenderProps<FieldValues, string>
    fieldState: ControllerFieldState
    required?: boolean
    className?: string
}

export function DatePicker({
    label,
    description,
    placeholder,
    defaultValue,
    field,
    fieldState,
    required,
    className,
}: DatePickerProps) {
    const { calendar } = useCalendarStore()
    const calendarYear = calendar ? Number(calendar) : new Date().getFullYear()
    const referenceDate = new Date(calendarYear, 0, 1)

    const [open, setOpen] = useState(false)
    const initialDate =
        (field.value && parseDateText(field.value, calendarYear)) ||
        defaultValue
    const [inputValue, setInputValue] = useState(
        initialDate ? formatDate(initialDate) : "",
    )
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(
        initialDate || undefined,
    )
    const [month, setMonth] = useState<Date | undefined>(
        selectedDate ?? referenceDate,
    )

    // biome-ignore lint/correctness/useExhaustiveDependencies: onChange is stable across renders for react-hook-form controllers
    useEffect(() => {
        if (field.value && field.value instanceof Date) {
            field.onChange(field.value.toISOString())
        } else if (field.value) {
            const date = parseDateText(field.value, calendarYear)
            setSelectedDate(date || undefined)
            setInputValue(date ? formatDate(date) : "")
            setMonth(date || referenceDate)
        } else {
            setInputValue("")
            setSelectedDate(undefined)
            setMonth(referenceDate)
        }
    }, [field.value])

    useEffect(() => {
        if (field.disabled && open) {
            setOpen(false)
        }
    }, [field.disabled, open])

    const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value)
    }

    const handleInputBlur = () => {
        const date = parseDateText(inputValue, calendarYear)
        if (date) {
            setSelectedDate(date)
            setMonth(date)
            field.onChange(date.toISOString()) // Submit ISO string
        } else {
            setSelectedDate(undefined)
            field.onChange(null)
        }
        field.onBlur()
    }

    const handleDateSelect = (date: Date | undefined) => {
        setSelectedDate(date)
        const formattedDate = formatDate(date)
        setInputValue(formattedDate)
        field.onChange(date ? date.toISOString() : null) // Submit ISO string
        setOpen(false)
    }

    return (
        <Field
            data-invalid={fieldState.invalid}
            className={cn("gap-1", className)}
        >
            <FieldLabel>{label}</FieldLabel>
            <div className="flex relative gap-2">
                <Input
                    {...field}
                    value={inputValue}
                    aria-required={required ? "true" : "false"}
                    aria-invalid={fieldState.invalid}
                    placeholder={placeholder ?? "Kies een datum"}
                    className="bg-background pr-10"
                    onChange={handleInputChange}
                    onBlur={handleInputBlur}
                    onKeyDown={(e) => {
                        if (e.key === "ArrowDown") {
                            e.preventDefault()
                            setOpen(true)
                        }
                    }}
                    required={required}
                />
                <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            id="date-picker"
                            variant="ghost"
                            className="absolute top-1/2 right-2 size-6 -translate-y-1/2"
                            disabled={field.disabled}
                        >
                            <CalendarIcon className="size-3.5" />
                            <span className="sr-only">
                                {placeholder ?? "Kies een datum"}
                            </span>
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent
                        className="w-auto overflow-hidden p-0"
                        align="end"
                    >
                        <Calendar
                            mode="single"
                            selected={selectedDate}
                            captionLayout="dropdown"
                            month={month}
                            onMonthChange={setMonth}
                            onSelect={handleDateSelect}
                            startMonth={new Date(1970, 0)}
                            endMonth={endMonth}
                            locale={calenderLocale}
                        />
                    </PopoverContent>
                </Popover>
            </div>
            {description && <FieldDescription>{description}</FieldDescription>}
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
    )
}

function formatDate(date: Date | undefined) {
    if (!date) {
        return ""
    }

    return format(date, "PPP", { locale: nl })
}

function parseDateText(
    date: string | Date | undefined,
    calendarYear?: number,
): Date | undefined {
    if (date instanceof Date) {
        return date
    }
    if (!date || date === "") {
        return undefined
    }

    const currentYear = new Date().getFullYear()
    const targetYear = calendarYear ?? currentYear

    // Only treat as ISO string when it matches YYYY-MM-DD... to avoid JS's lenient Date parsing
    // (e.g. new Date("1-4-2025") returns January 4th — American order — before Dutch pre-processor runs).
    if (/^\d{4}-\d{2}-\d{2}/.test(date)) {
        const isoDate = new Date(date)
        if (!Number.isNaN(isoDate.getTime())) {
            return isoDate
        }
    }

    // Dutch numeric format: DD-MM, DD-MM-YY, DD-MM-YYYY (e.g. "1-4", "1-4-25", "01-04-2025")
    // Processed before chrono-node because chrono-node uses American MM-DD order for numeric dates.
    const dutchNumeric = parseDutchNumericDate(date, targetYear)
    if (dutchNumeric) {
        return dutchNumeric
    }

    // Chrono-node always uses actual today as reference so relative terms ("gisteren", "vandaag")
    // resolve to the correct real-world date.
    const results = chrono.nl.parse(date, new Date())
    if (!results?.length) {
        return undefined
    }
    const result = results[0]
    const parsedDate = result.start.date()

    // When a specific date was mentioned (month or day explicit) but no year was stated,
    // override the year with the active calendar year. Skip for pure relative terms like
    // "gisteren" where neither month nor day is explicit.
    if (
        targetYear !== currentYear &&
        !result.start.isCertain("year") &&
        (result.start.isCertain("month") || result.start.isCertain("day"))
    ) {
        parsedDate.setFullYear(targetYear)
    }

    return parsedDate
}

// Parses Dutch numeric date format DD-MM, DD-MM-YY or DD-MM-YYYY.
// Returns undefined when the input doesn't match or produces an invalid date.
function parseDutchNumericDate(
    text: string,
    targetYear: number,
): Date | undefined {
    const match = text
        .trim()
        .match(/^(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?$/)
    if (!match) {
        return undefined
    }
    const day = Number(match[1])
    const month = Number(match[2])
    if (day < 1 || day > 31 || month < 1 || month > 12) {
        return undefined
    }
    let year = targetYear
    if (match[3]) {
        const y = Number(match[3])
        year = match[3].length <= 2 ? 2000 + y : y
    }
    const result = new Date(year, month - 1, day)
    if (Number.isNaN(result.getTime()) || result.getMonth() !== month - 1) {
        return undefined
    }
    return result
}
