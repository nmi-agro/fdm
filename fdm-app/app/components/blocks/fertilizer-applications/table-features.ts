import { columnVisibilityFeature, tableFeatures } from "@tanstack/react-table"

export interface FertAppTableMeta {
  returnUrl?: string
}

export const fertAppTableFeatures = tableFeatures({
  columnVisibilityFeature: columnVisibilityFeature,
  tableMeta: {} as FertAppTableMeta,
})
