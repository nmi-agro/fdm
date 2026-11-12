import { useId, useMemo } from "react"
import type { ScenarioFertilizerOption } from "~/lib/mineralization"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  createComboboxItems,
} from "~/components/ui/combobox"
import { Field, FieldContent, FieldLabel } from "~/components/ui/field"
import { useKeyedState } from "~/hooks/use-keyed-state"

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
  const id = useId()
  const items = useMemo(
    () =>
      createComboboxItems(options, {
        getValue: (option) => option.p_id,
        getLabel: (option) => option.p_name_nl ?? option.p_id,
      }),
    [options],
  )

  const selectedLabel = useMemo(() => {
    const selected = options.find((option) => option.p_id === value)
    return selected ? (selected.p_name_nl ?? selected.p_id) : ""
  }, [options, value])
  // Resets to the selected fertilizer whenever the selection changes from outside.
  const [inputValue, setInputValue] = useKeyedState(selectedLabel, (label) => label)

  return (
    <Field className="gap-1">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <FieldContent className="leading-none">
        <Combobox
          items={items}
          value={value || null}
          inputValue={inputValue}
          onInputValueChange={setInputValue}
          onOpenChange={(open) => {
            // A cleared or partially typed query must not outlive the popup: the selection is kept.
            if (!open) setInputValue(selectedLabel)
          }}
          onValueChange={(next) => {
            if (next && next !== value) onChange(next)
            else if (!next) setInputValue(selectedLabel)
          }}
        >
          <ComboboxInput id={id} />
          <ComboboxContent>
            <ComboboxEmpty>Geen meststoffen gevonden.</ComboboxEmpty>
            <ComboboxList>
              {(item) => (
                <ComboboxItem key={item.p_id} value={item.p_id}>
                  {item.p_name_nl ?? item.p_id}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </FieldContent>
    </Field>
  )
}
