import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createFilteredRowModel,
  createSortedRowModel,
  globalFilteringFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_text,
  tableFeatures,
} from "@tanstack/react-table"

export const fieldSummaryTableFeatures = tableFeatures({
  columnFilteringFeature: columnFilteringFeature,
  columnVisibilityFeature: columnVisibilityFeature,
  filteredRowModel: createFilteredRowModel(),
  globalFilteringFeature: globalFilteringFeature,
  rowSelectionFeature: rowSelectionFeature,
  rowSortingFeature: rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { text: sortFn_text },
})
