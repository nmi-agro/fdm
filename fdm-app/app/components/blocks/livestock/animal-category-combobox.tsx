import { useMemo } from "react"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  createComboboxItems,
} from "~/components/ui/combobox"

/** An animal category of RVO that a herd can belong to. */
export interface AnimalCategoryOption {
  l_id_category: string
  l_category: string
  l_lsu: number | null
}

/** The label of a category in the list, with its livestock units per animal. */
const categoryLabel = (category: AnimalCategoryOption) =>
  `${category.l_category} (${(category.l_lsu ?? 1).toLocaleString("nl-NL")} GVE/dier)`

/**
 * A searchable choice of the animal category of a herd: typing part of the name or code filters
 * the list. The value is the category ID; clearing the input gives an empty string.
 *
 * @param props.id - The id of the input, for its label.
 * @param props.categories - The categories to choose from.
 * @param props.value - The chosen category ID, or an empty string for none.
 * @param props.onValueChange - Called with the chosen category ID, or an empty string when cleared.
 */
export function AnimalCategoryCombobox({
  id,
  categories,
  value,
  onValueChange,
}: {
  id: string
  categories: AnimalCategoryOption[]
  value: string
  onValueChange: (l_id_category: string) => void
}) {
  const items = useMemo(
    () =>
      createComboboxItems(categories, {
        getValue: (category) => category.l_id_category,
        getLabel: categoryLabel,
      }),
    [categories],
  )

  return (
    <Combobox
      items={items}
      value={value || null}
      onValueChange={(next) => onValueChange(next ?? "")}
    >
      <ComboboxInput id={id} />
      <ComboboxContent>
        <ComboboxEmpty>Geen diercategorie gevonden.</ComboboxEmpty>
        <ComboboxList>
          {(item: AnimalCategoryOption) => (
            <ComboboxItem key={item.l_id_category} value={item.l_id_category}>
              {categoryLabel(item)}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
