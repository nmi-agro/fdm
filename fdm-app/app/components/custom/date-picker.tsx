import type { FieldValues, Path, UseFormReturn } from "react-hook-form"
import * as chrono from "chrono-node"
import { format } from "date-fns"
import { nl } from "date-fns/locale"
import { CalendarIcon } from "lucide-react"
import React from "react"
import { useWatch } from "react-hook-form"
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
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover"
import { useKeyedState } from "~/hooks/use-keyed-state"
import { endMonth } from "~/lib/calendar"
import { useCalendarStore } from "~/store/calendar"

function parseDateString(dateString: string, calendarYear: number): Date | undefined {
  if (!dateString) {
    return undefined
  }

  const currentYear = new Date().getFullYear()

  // Dutch numeric format: DD-MM, DD-MM-YY, DD-MM-YYYY
  const dutchNumeric = parseDutchNumericDate(dateString, calendarYear)
  if (dutchNumeric) {
    return dutchNumeric
  }

  // Chrono-node always uses today as reference so relative terms ("gisteren") work correctly.
  const results = chrono.nl.parse(dateString, new Date())
  if (!results?.length) {
    // Fallback to default Date parsing for ISO-like strings
    const defaultDate = new Date(dateString)
    return isValidDate(defaultDate) ? defaultDate : undefined
  }
  const result = results[0]
  const parsedDate = result.start.date()

  // Override with calendar year only for explicit partial dates (month/day stated, year not).
  if (
    calendarYear !== currentYear &&
    !result.start.isCertain("year") &&
    (result.start.isCertain("month") || result.start.isCertain("day"))
  ) {
    parsedDate.setFullYear(calendarYear)
  }

  return isValidDate(parsedDate) ? parsedDate : undefined
}

// Parses Dutch numeric date format DD-MM, DD-MM-YY or DD-MM-YYYY.
function parseDutchNumericDate(text: string, targetYear: number): Date | undefined {
  const match = text.trim().match(/^(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?$/)
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
  disabled?: boolean
}

export function DatePicker<TFieldValues extends FieldValues>({
  form,
  name,
  label,
  description,
  disabled = false,
}: DatePickerProps<TFieldValues>) {
  const { calendar } = useCalendarStore()
  // Computed once, not on every render: only used as a fallback when the store has no calendar yet.
  const [defaultYear] = React.useState(() => new Date().getFullYear())
  const calendarYear = calendar ? Number(calendar) : defaultYear
  const referenceDate = new Date(calendarYear, 0, 1)

  const [open, setOpen] = React.useState(false)

  // The field's value, read reactively so external changes (form.reset(), a sibling setting this
  // field) are picked up without an effect synchronizing a local copy of it.
  const watchedValue: unknown = useWatch({ control: form.control, name })
  const date = watchedValue instanceof Date && isValidDate(watchedValue) ? watchedValue : undefined
  // Keyed on the resolved date so the calendar page, raw input text, and validity reset whenever
  // the field's value changes from outside this component, while surviving this component's own
  // (in sync) updates to it.
  const dateKey = date ? date.getTime() : null
  const [month, setMonth] = useKeyedState(dateKey, () => date || referenceDate)
  const [value, setValue] = useKeyedState(dateKey, () => formatDate(date))
  const [isInputValid, setIsInputValid] = useKeyedState(dateKey, () => true)

  const effectiveOpen = open && !disabled

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
                    setValue("")
                    field.onChange(undefined)
                    setIsInputValid(true)
                    field.onBlur()
                    return
                  }

                  const newDate = parseDateString(text, calendarYear)
                  if (newDate && isValidDate(newDate)) {
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
            <Popover open={effectiveOpen} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  id={`${field.name}-picker`}
                  variant="ghost"
                  className="absolute top-1/2 right-2 size-6 -translate-y-1/2"
                  disabled={disabled}
                >
                  <CalendarIcon className="size-3.5" />
                  <span className="sr-only">Kies een datum</span>
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
          <FormMessage>{!isInputValid ? "Ongeldige datum" : null}</FormMessage>
        </FormItem>
      )}
    />
  )
}
