import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createExpandedRowModel,
  createFilteredRowModel,
  createSortedRowModel,
  globalFilteringFeature,
  rowExpandingFeature,
  rowSelectionFeature,
  RowSelectionState,
  rowSortingFeature,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
} from "@tanstack/react-table"

export const rotationTableFeatures = tableFeatures({
  columnFilteringFeature: columnFilteringFeature,
  columnVisibilityFeature: columnVisibilityFeature,
  expandedRowModel: createExpandedRowModel(),
  filteredRowModel: createFilteredRowModel(),
  globalFilteringFeature: globalFilteringFeature,
  rowExpandingFeature: rowExpandingFeature,
  rowSelectionFeature: rowSelectionFeature,
  rowSortingFeature: rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { basic: sortFn_basic, text: sortFn_text, datetime: sortFn_datetime },
  tableMeta: {} as {
    lastSelectedRowIndex: { current: string | null }
    previousSelection: { current: RowSelectionState | undefined }
  },
})
