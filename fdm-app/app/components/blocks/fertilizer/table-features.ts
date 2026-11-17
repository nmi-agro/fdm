import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createExpandedRowModel,
  createFilteredRowModel,
  createSortedRowModel,
  globalFilteringFeature,
  rowExpandingFeature,
  rowSortingFeature,
  sortFn_text,
  tableFeatures,
} from "@tanstack/react-table"

export const fertilizerTableFeatures = tableFeatures({
  columnFilteringFeature: columnFilteringFeature,
  columnVisibilityFeature: columnVisibilityFeature,
  expandedRowModel: createExpandedRowModel(),
  filteredRowModel: createFilteredRowModel(),
  globalFilteringFeature: globalFilteringFeature,
  rowExpandingFeature: rowExpandingFeature,
  rowSortingFeature: rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { text: sortFn_text },
})
