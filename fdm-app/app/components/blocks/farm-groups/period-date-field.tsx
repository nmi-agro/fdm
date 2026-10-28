import { format } from "date-fns"
import { DatePicker } from "~/components/custom/date-picker-v2"

/**
 * Converts a `YYYY-MM-DD` string to the ISO string the date picker works with, at local midnight.
 */
function toPickerValue(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) {
    return null
  }
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).toISOString()
}

/**
 * Converts the ISO string of the date picker back to the calendar date the user picked, as
 * `YYYY-MM-DD`. The local date is used so the chosen day does not shift with the time zone.
 */
function fromPickerValue(value: string | null): string {
  if (!value) {
    return ""
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "" : format(date, "yyyy-MM-dd")
}

/**
 * A date field for the period in which a farm is part of a farm group.
 *
 * Wraps the shared date picker and works with calendar dates in the format `YYYY-MM-DD`. When
 * `name` is set, the value is also posted with the surrounding form as a hidden field.
 *
 * @param props.label - The label above the field.
 * @param props.value - The selected date as `YYYY-MM-DD`, or an empty string for no date.
 * @param props.onChange - Called with the new date as `YYYY-MM-DD`, or an empty string when cleared.
 * @param props.name - Optional field name for a surrounding form.
 * @param props.description - Optional help text below the field.
 * @param props.required - Whether a date is required.
 * @returns A React node.
 */
export function PeriodDateField({
  label,
  value,
  onChange,
  name,
  description,
  required,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  name?: string
  description?: string
  required?: boolean
}) {
  return (
    <>
      <DatePicker
        label={label}
        description={description}
        required={required}
        field={{
          name: "",
          value: toPickerValue(value),
          onChange: (next: string | null) => onChange(fromPickerValue(next)),
          onBlur: () => {},
          ref: () => {},
        }}
        fieldState={{
          invalid: false,
          isDirty: false,
          isTouched: false,
          isValidating: false,
        }}
      />
      {name && <input type="hidden" name={name} value={value} />}
    </>
  )
}
