import {
  createSortedRowModel,
  rowSortingFeature,
  sortFn_basic,
  sortFn_datetime,
  tableFeatures,
} from "@tanstack/react-table"

export interface BemestingsplanTableMeta {
  b_id_farm: string
  b_name_farm: string
  canModify: boolean
  deleting(p_id_plan: string): boolean
  onDelete(p_id_plan: string): void
}

export const bemestingsplanTableFeatures = tableFeatures({
  rowSortingFeature: rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { datetime: sortFn_datetime, basic: sortFn_basic },
  tableMeta: {} as BemestingsplanTableMeta,
})
