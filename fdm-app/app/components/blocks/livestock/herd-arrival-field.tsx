import { format } from "date-fns"
import { DatePicker } from "~/components/custom/date-picker-v2"

/**
 * Date field for the day on which the animals of a new herd arrived and joined it. The value is a
 * day as `YYYY-MM-DD`; the form submits it as `l_arriving_date` (see `parseHerdArrival`).
 */
export function HerdArrivalField({
  value,
  onChange,
}: {
  value: string
  onChange: (dayKey: string) => void
}) {
  return (
    <DatePicker
      label="Aanwezig sinds *"
      description="Weet je de datum niet? Laat dan 1 januari staan."
      field={{
        name: "l_arriving_date_text",
        value,
        onChange: (val) => onChange(val ? format(new Date(val), "yyyy-MM-dd") : ""),
        onBlur: () => {},
        ref: () => {},
      }}
      fieldState={{ invalid: false, isTouched: false, isDirty: false, isValidating: false }}
      placeholder="Kies een datum"
      required
    />
  )
}
