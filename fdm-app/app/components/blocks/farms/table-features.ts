import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createExpandedRowModel,
  createFilteredRowModel,
  createSortedRowModel,
  globalFilteringFeature,
  rowExpandingFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_text,
  tableFeatures,
} from "@tanstack/react-table"

export const farmTableFeatures = tableFeatures({
  columnFilteringFeature: columnFilteringFeature,
  columnVisibilityFeature: columnVisibilityFeature,
  expandedRowModel: createExpandedRowModel(),
  filteredRowModel: createFilteredRowModel(),
  globalFilteringFeature: globalFilteringFeature,
  rowExpandingFeature: rowExpandingFeature,
  rowSelectionFeature: rowSelectionFeature,
  rowSortingFeature: rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { text: sortFn_text },
})
