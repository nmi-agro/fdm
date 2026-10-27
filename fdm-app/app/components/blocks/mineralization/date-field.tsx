import type { ControllerFieldState, ControllerRenderProps, FieldValues } from "react-hook-form"
import { format } from "date-fns"
import { useState } from "react"
import { DatePicker } from "~/components/custom/date-picker-v2"
import { formatLongDate } from "~/lib/mineralization"

/** Local midnight of a calendar date (`YYYY-MM-DD`) as ISO string, the value DatePicker expects. */
function toPickerValue(date: string): string {
  const [y, m, d] = date.split("-").map(Number)
  return new Date(y, m - 1, d).toISOString()
}

/**
 * The app's date picker for a calendar date (`YYYY-MM-DD`) kept in plain React state instead of a
 * react-hook-form field. Dates outside `min`–`max` are rejected with a message.
 */
export function DateField({
  name,
  label,
  value,
  onChange,
  min,
  max,
  required,
  className,
}: {
  name: string
  label: string
  /** Selected date (`YYYY-MM-DD`). */
  value: string
  onChange: (date: string) => void
  /** Earliest allowed date (`YYYY-MM-DD`). */
  min?: string
  /** Latest allowed date (`YYYY-MM-DD`). */
  max?: string
  required?: boolean
  className?: string
}) {
  const [error, setError] = useState<string | null>(null)

  const field = {
    name,
    value: value ? toPickerValue(value) : "",
    disabled: false,
    ref: () => undefined,
    onBlur: () => undefined,
    onChange: (next: string | null) => {
      if (!next) {
        setError(required ? "Vul een datum in." : null)
        return
      }
      const date = format(new Date(next), "yyyy-MM-dd")
      if ((min && date < min) || (max && date > max)) {
        const year = min?.slice(0, 4)
        setError(
          year && min === `${year}-01-01` && max === `${year}-12-31`
            ? `Kies een datum in ${year}.`
            : `Kies een datum tussen ${formatLongDate(min ?? date)} en ${formatLongDate(max ?? date)}.`,
        )
        return
      }
      setError(null)
      if (date !== value) onChange(date)
    },
  } as unknown as ControllerRenderProps<FieldValues, string>

  const fieldState: ControllerFieldState = {
    invalid: error !== null,
    isTouched: true,
    isDirty: false,
    isValidating: false,
    error: error ? { type: "validate", message: error } : undefined,
  }

  return (
    <DatePicker
      label={label}
      field={field}
      fieldState={fieldState}
      required={required}
      className={className}
    />
  )
}
