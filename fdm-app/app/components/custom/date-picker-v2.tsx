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
    const [open, setOpen] = useState(false)
    const initialDate =
        (field.value && parseDateText(field.value)) || defaultValue
    const [inputValue, setInputValue] = useState(
        initialDate ? formatDate(initialDate) : "",
    )
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(
        initialDate || undefined,
    )
    const [month, setMonth] = useState<Date | undefined>(selectedDate)

    // biome-ignore lint/correctness/useExhaustiveDependencies: onChange is stable across renders for react-hook-form controllers
    useEffect(() => {
        if (field.value && field.value instanceof Date) {
            field.onChange(field.value.toISOString())
        } else if (field.value) {
            const date = parseDateText(field.value)
            setSelectedDate(date || undefined)
            setInputValue(date ? formatDate(date) : "")
            setMonth(date || undefined)
        } else {
            setInputValue("")
            setSelectedDate(undefined)
            setMonth(undefined)
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
        const date = parseDateText(inputValue)
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
                    placeholder={ placeholder ?? "Kies een datum" }
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

function parseDateText(date: string | Date | undefined): Date | undefined {
    if (date instanceof Date) {
        return date
    }
    if (!date || date === "") {
        return undefined
    }

    // Attempt to parse as ISO string first
    const isoDate = new Date(date)
    if (!Number.isNaN(isoDate.getTime())) {
        return isoDate
    }

    // Fallback to chrono-node for localized strings
    const referenceDate = new Date()
    const parsedDate = chrono.nl.parseDate(date, referenceDate)
    if (!parsedDate) {
        return undefined
    }

    return parsedDate
}
