import { useMemo, useState } from "react"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  createComboboxItems,
} from "~/components/ui/combobox"

/** A cultivation that can be chosen. */
export type CropOption = { value: string; label: string }

/**
 * Searchable cultivation picker for a plain form, built on the same combobox as the cultivation
 * forms. The chosen catalogue code is submitted as a hidden input with the given name; it is empty
 * when no cultivation is chosen.
 *
 * @param props.name - Name of the hidden input that holds the catalogue code.
 * @param props.options - The cultivations to choose from.
 * @param props.defaultValue - Catalogue code chosen at first, if any.
 * @param props.disabled - Whether the picker can be used.
 * @param props.placeholder - Text shown while no cultivation is chosen.
 */
export function CropPicker({
  name,
  options,
  defaultValue,
  disabled,
  placeholder = "Kies een gewas",
}: {
  name: string
  options: CropOption[]
  defaultValue?: string | null
  disabled?: boolean
  placeholder?: string
}) {
  const [value, setValue] = useState(defaultValue ?? "")
  const items = useMemo(
    () =>
      createComboboxItems(options, {
        getValue: (option) => option.value,
        getLabel: (option) => option.label,
      }),
    [options],
  )

  return (
    <>
      <input type="hidden" name={name} value={value} />
      <Combobox
        items={items}
        value={value || null}
        onValueChange={(next) => setValue(next ?? "")}
        disabled={disabled}
      >
        <ComboboxInput placeholder={placeholder} className="w-full min-w-48" />
        <ComboboxContent>
          <ComboboxEmpty>Geen gewassen gevonden.</ComboboxEmpty>
          <ComboboxList>
            {(item) => (
              <ComboboxItem key={item.value} value={item.value}>
                {item.label}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </>
  )
}
