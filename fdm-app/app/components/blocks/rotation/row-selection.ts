import { Row, Table } from "@tanstack/react-table"
import { MouseEvent } from "react"
import { useRotationSelectionStore } from "~/store/rotation-selection"
import { FieldRow, MemoizedFieldRow, MemoizedRotationExtended } from "./columns"
import { rotationTableFeatures } from "./table-features"

export function buildRowSelection(
  mySelection: Record<string, Record<string, boolean>>,
  myMemoizedData: readonly MemoizedRotationExtended[],
  globalFilterFn: ((row: { original: MemoizedRotationExtended }) => boolean) | undefined,
) {
  // TanStack Table v9 treats any key present in the selection map as selected
  // (regardless of its value), so only truthy entries may be included here.
  return Object.fromEntries(
    [
      // Crop selection state is derived from whether all its fields are selected
      ...myMemoizedData.map((crop) => [
        `crop_${crop.b_lu_catalogue}`,
        crop.fields &&
          crop.fields.length > 0 &&
          (crop.fields as MemoizedFieldRow[]).every(
            (field) =>
              (globalFilterFn && !globalFilterFn({ original: field })) ||
              mySelection[crop.b_lu_catalogue]?.[field.b_id],
          ),
      ]),
      // Include each field's selection state too
      ...myMemoizedData.flatMap((crop) =>
        (crop.fields ?? []).map((field) => [
          `${crop.b_lu_catalogue}_${field.b_id}`,
          !!mySelection[crop.b_lu_catalogue]?.[field.b_id],
        ]),
      ),
    ].filter(([, value]) => value),
  )
}

export function handleRowSelection(
  row: Row<typeof rotationTableFeatures, MemoizedRotationExtended>,
  table: Table<typeof rotationTableFeatures, MemoizedRotationExtended>,
  event: MouseEvent<{ checked: boolean }>,
) {
  if (!table.options.meta) return

  // Ignore clicks on interactive elements inside the row
  const isInteractive = (target: EventTarget | null): boolean => {
    if (!(target instanceof Element)) return false
    return !!target.closest(
      'a,button,input,label,select,textarea,[role="button"],[role="link"],[role="checkbox"],[data-prevent-row-click="true"]',
    )
  }

  if (isInteractive(event.target)) {
    // If a link was clicked, let the default navigation happen
    return
  }

  const mode = !row.getIsSelected()

  const selection = useRotationSelectionStore.getState().selection

  const newSelection = Object.fromEntries(Object.entries(selection).map(([k, v]) => [k, { ...v }]))

  function setRowSelection(fieldRow: FieldRow, value: boolean) {
    if (value || newSelection[fieldRow.b_lu_catalogue]) {
      if (!newSelection[fieldRow.b_lu_catalogue]) {
        newSelection[fieldRow.b_lu_catalogue] = {}
      }
      newSelection[fieldRow.b_lu_catalogue][fieldRow.b_id] = value
    }
  }

  // If there was a last row selected and the shift key is pressed
  const lastSelectedRowIndex = table.options.meta?.lastSelectedRowIndex.current
  if (event.shiftKey && lastSelectedRowIndex) {
    const flatRows = table.getFilteredRowModel().flatRows
    let firstRowIndex = flatRows.indexOf(table.getRow(lastSelectedRowIndex))
    let lastRowIndex = flatRows.indexOf(row)
    if (firstRowIndex > lastRowIndex) {
      const tmpIndex = firstRowIndex
      firstRowIndex = lastRowIndex
      lastRowIndex = tmpIndex
    }
    for (let i = firstRowIndex; i <= lastRowIndex; i++) {
      const flatRow = flatRows[i]
      if (flatRow.original.type === "field") {
        setRowSelection(flatRow.original, mode)
      }
    }
  }

  // Deal with the currently clicked row
  if (row.original.type === "crop") {
    for (const fieldRow of row.subRows) {
      if (fieldRow.original.type === "field") {
        setRowSelection(fieldRow.original, mode)
      }
    }
  } else {
    setRowSelection(row.original, mode)
  }

  useRotationSelectionStore.getState().setSelection(newSelection)
  table.options.meta.lastSelectedRowIndex.current = row.id
  table.options.meta.previousSelection.current = buildRowSelection(
    newSelection,
    table.options.data,
    table.getGlobalFilterFn() as any,
  )
}
