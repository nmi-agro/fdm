import {
  columnGroupingFeature,
  columnVisibilityFeature,
  createSortedRowModel,
  rowSortingFeature,
  tableFeatures,
} from "@tanstack/react-table"

export const overviewTableFeatures = tableFeatures({
  columnGroupingFeature: columnGroupingFeature,
  columnVisibilityFeature: columnVisibilityFeature,
  rowSortingFeature: rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
})
