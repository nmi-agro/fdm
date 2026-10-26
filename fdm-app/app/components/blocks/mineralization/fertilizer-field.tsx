import { useForm } from "react-hook-form"
import type { ScenarioFertilizerOption } from "~/lib/mineralization"
import { Combobox } from "~/components/custom/combobox"
import { Form } from "~/components/ui/form"

/**
 * Searchable fertilizer choice, using the same combobox as the fertilizer application form, for a
 * value kept in plain React state. Every selection is passed on through `onChange`.
 */
export function FertilizerField({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  /** Selected fertilizer (`p_id`). */
  value: string
  options: ScenarioFertilizerOption[]
  onChange: (p_id: string) => void
}) {
  // The combobox needs a react-hook-form context; `values` keeps it in sync with the scenario
  const form = useForm<{ p_id: string }>({ values: { p_id: value } })
  const comboboxOptions = options.map((o) => ({ value: o.p_id, label: o.p_name_nl ?? o.p_id }))

  return (
    <Form {...form}>
      <Combobox
        options={comboboxOptions}
        name="p_id"
        label={label}
        defaultValue={value}
        form={{
          control: form.control,
          setValue: (name, next) => {
            form.setValue(name, next)
            if (next !== value) onChange(next)
          },
        }}
      />
    </Form>
  )
}
