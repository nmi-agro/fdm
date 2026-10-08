import { Row, RowData, rowSelectionFeature, TableFeatures } from "@tanstack/react-table"
import { cn } from "~/lib/utils"

type AssumedTableFeatures = {
  rowSelectionFeature: typeof rowSelectionFeature
}

type AssumedRow<TData extends RowData> = Partial<Row<AssumedTableFeatures, TData>> & { id: string }

/**
 * Gets the TailwindCSS class names to render the hover and selection states and concaveness outlines of
 * a complex data table row in fdm-app.
 *
 * @param row row from a Tanstack Table to style. It can be a selectable row, where this function will
 * set the selection classes accordingly.
 * @param concave whether to render the row darker with a shadow outline, emulating rows physically sunken
 * into the page. Set to true for sub-rows in a data-table with expandable rows.
 * @returns a string containing the TailwindCSS classes.
 */
export function dataTableRowCN<TFeatures extends TableFeatures, TData extends RowData>(
  row: Row<TFeatures, TData>,
  concave = false,
) {
  const parentRow = row.getParentRow()
  const parentSubRows = parentRow
    ? row.table.getRowModel().rows.find((r) => parentRow.id === r.id)?.subRows
    : undefined
  return cn(
    (row as unknown as AssumedRow<TData>).getIsSelected?.()
      ? "bg-green-100 hover:bg-green-300/50"
      : (row as unknown as AssumedRow<TData>).getIsSomeSelected?.()
        ? "bg-green-50 hover:bg-green-300/25"
        : concave
          ? "bg-muted/50 hover:bg-muted"
          : "data-[state=selected]:bg-muted data-[state=indeterminate]:bg-muted/50",
    concave &&
      !!parentSubRows &&
      (parentSubRows.length === 1
        ? "shadow-[inset_0_1em_2em_-2em_#00000088,inset_0_-1em_2em_-2em_#00000088]"
        : parentSubRows.findIndex((subRow) => subRow.id === row.id) === 0
          ? "shadow-[inset_0_1em_2em_-2em_#00000088]"
          : parentSubRows.findIndex((subRow) => subRow.id === row.id) ===
              parentSubRows.length - 1 && "shadow-[inset_0_-1em_2em_-2em_#00000088]"),
  )
}

/**
 * Gets the TailwindCSS class names for the opaque background of a sticky cell while it is stuck
 * (marked with the `data-stuck` attribute), so the cell keeps the selection color of its row.
 *
 * @param row row from a Tanstack Table that contains the sticky cell. It can be a selectable row.
 * @returns a string containing the TailwindCSS classes.
 */
export function dataTableStickyCellCN<TFeatures extends TableFeatures, TData extends RowData>(
  row: Row<TFeatures, TData>,
) {
  const assumedRow = row as unknown as AssumedRow<TData>
  if (assumedRow.getIsSelected?.()) return "data-stuck:bg-green-100"
  if (assumedRow.getIsSomeSelected?.()) return "data-stuck:bg-green-50"
  return "data-stuck:bg-background"
}
