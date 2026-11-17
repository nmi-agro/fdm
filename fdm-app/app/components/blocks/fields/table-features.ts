import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createFilteredRowModel,
  createSortedRowModel,
  globalFilteringFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  tableFeatures,
} from "@tanstack/react-table"

export const fieldsTableFeatures = tableFeatures({
  columnFilteringFeature: columnFilteringFeature,
  columnVisibilityFeature: columnVisibilityFeature,
  filteredRowModel: createFilteredRowModel(),
  globalFilteringFeature: globalFilteringFeature,
  rowSelectionFeature: rowSelectionFeature,
  rowSortingFeature: rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric },
})
