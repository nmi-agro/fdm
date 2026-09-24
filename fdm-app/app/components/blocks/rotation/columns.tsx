import { createColumnHelper, type Row } from "@tanstack/react-table"
import { ChevronRight } from "lucide-react"
import { useMemo } from "react"
import { NavLink } from "react-router"
import { cn } from "@/app/lib/utils"
import { DataTableColumnHeader } from "~/components/blocks/data-table/column-header"
import { getHarvestTerm } from "~/components/blocks/harvest/utils"
import { Button } from "~/components/ui/button"
import { Checkbox } from "~/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { ScrollArea } from "~/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip"
import { CropResidueCheckbox } from "./crop-residue-checkbox"
import { DateRangeDisplay } from "./date-range-display"
import { TableDateSelector } from "./date-selector"
import { FertilizerDisplay } from "./fertilizer-display"
import { HarvestDatesDisplay } from "./harvest-dates-display"
import { NameCell } from "./name-cell"
import { handleRowSelection } from "./row-selection"
import { rotationTableFeatures } from "./table-features"
import { TableVarietySelector } from "./variety-selector"

export type CropRow = {
  type: "crop"
  canModify: boolean
  b_lu_catalogue: string
  b_lu_name: string
  b_lu_eom_residue: number | null
  b_lu_variety_options: { label: string; value: string }[] | null
  b_lu_croprotation: string
  b_lu_harvestable: "once" | "multiple" | "none"
  calendar: string
  fields: FieldRow[]
}

export type FieldRow = {
  type: "field"
  canModify: boolean
  b_id: string
  b_name: string
  b_area: number
  b_bufferstrip: boolean
  a_som_loi: string | number
  b_soiltype_agr: string | number
  m_cropresidue: "all" | "some" | "none"
  b_lu_eom_residue: number | null
  m_cropresidue_ending: [Date, boolean][]
  b_lu_variety: [string, number][]
  b_lu_catalogue: string
  b_lu_croprotation: string
  harvests: {
    b_lu: string
    b_id_harvesting: string
    b_lu_harvest_date: Date | null
  }[]
  b_lu_harvestable: "once" | "multiple" | "none"
  calendar: string
  b_lu_start: Date[]
  b_lu_end: Date[]
  fertilizers: {
    p_name_nl: string | null
    p_id: string
    p_type: string | null
    p_type_rvo?: string | null
  }[]
  fields?: undefined
}

export type RotationExtended = CropRow | FieldRow

export type MemoizedFieldRow = FieldRow & { searchTarget: string }
export type MemoizedCropRow = CropRow & { searchTarget: string; fields: MemoizedFieldRow[] }
export type MemoizedRotationExtended = MemoizedCropRow | MemoizedFieldRow

/**
 * Get the total area of the fields associated with a row.
 *
 * @param row Either a crop row, representing the field rows below it, or a field row.
 * @returns the total field area.
 */
function getRowTotalArea(row: Row<typeof rotationTableFeatures, MemoizedRotationExtended>): number {
  if (row.original.type === "field") {
    return row.original.b_area ?? 0
  }
  return (row.subRows ?? []).reduce(
    (total, fieldRow) => total + (fieldRow.original as FieldRow).b_area,
    0,
  )
}

/**
 * Collects the cultivation start or end dates, either from the given field row, or the field rows under the given crop row.
 * @param row Crop or field row.
 * @param key "b_lu_start" or "b_lu_end".
 * @returns an array of encountered dates with duplicates.
 */
function getRowDates(
  row: Row<typeof rotationTableFeatures, MemoizedRotationExtended>,
  key: "b_lu_start" | "b_lu_end",
): Date[] {
  if (row.original.type === "field") {
    return row.original[key]
  }

  return row.subRows
    .reduce(
      (concatenated, row) => concatenated.concat((row.original as FieldRow)[key]),
      [] as Date[],
    )
    .sort((a, b) => a.getTime() - b.getTime())
}

/**
 * Gets a flat array of harvest dates.
 * @param row crop or field row to extract the harvest dates from.
 * @returns an array of dates, which might be empty.
 */
function getHarvestDates(row: Row<typeof rotationTableFeatures, MemoizedRotationExtended>) {
  const fields =
    row.original.type === "field" ? [row.original] : row.subRows.map((r) => r.original as FieldRow)

  return fields
    .flatMap((field) =>
      field.harvests.map((harvest) => harvest.b_lu_harvest_date).filter((x): x is Date => !!x),
    )
    .sort((a, b) => a.getTime() - b.getTime())
}

const columnHelper = createColumnHelper<typeof rotationTableFeatures, MemoizedRotationExtended>()
export const columns = columnHelper.columns([
  columnHelper.display({
    id: "Children",
    enableHiding: false,
    cell: ({ row }) => {
      return row.getCanExpand() ? (
        <button
          type="button"
          onClick={row.getToggleExpandedHandler()}
          style={{ cursor: "pointer" }}
        >
          <ChevronRight
            className={cn(
              "text-muted-foreground transition-transform duration-300",
              row.getIsExpanded() ? "rotate-90" : "transform-none",
            )}
          />
        </button>
      ) : (
        ""
      )
    },
  }),
  columnHelper.display({
    id: "select",
    header: ({ table }) => {
      return (
        <div className="pe-4">
          <Checkbox
            checked={
              table.getIsAllRowsSelected()
                ? true
                : table.getIsSomeRowsSelected()
                  ? "indeterminate"
                  : false
            }
            onCheckedChange={(value) => table.toggleAllRowsSelected(!!value)}
            aria-label="Selecteer alle rijen"
          />
        </div>
      )
    },
    cell: ({ row, table }) => (
      <div className={cn(row.original.type === "field" ? "ps-4" : "pe-4")}>
        <Checkbox
          checked={row.getIsSelected() ? true : row.getIsSomeSelected() ? "indeterminate" : false}
          // Do not use row.getToggleSelectedHandler() here since it doesn't have the exact child-parent selection behavior we want.
          // It selects all children of the last crop row, while we want to only select until the last clicked field row.
          onClick={(event) =>
            handleRowSelection(row, table, {
              ...event,
              target: { ...event.currentTarget, checked: !row.getIsSelected() } as EventTarget,
              currentTarget: { ...event.currentTarget, checked: !row.getIsSelected() },
            })
          }
          aria-label="Selecteer deze rij"
        />
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
  }),
  columnHelper.accessor((row) => (row.type === "crop" ? row.b_lu_name : row.b_name), {
    id: "name",
    enableSorting: true,
    header: ({ column }) => {
      return <DataTableColumnHeader column={column} title="Gewas" />
    },
    cell: (context) => <NameCell {...context} />,
  }),
  // An accessor fn is needed to make the column appear as sortable
  columnHelper.accessor(() => null, {
    id: "b_lu_start",
    enableSorting: true,
    sortFn: (a, b) => {
      const datesA = getRowDates(a, "b_lu_start")
      const datesB = getRowDates(b, "b_lu_start")

      return datesA.length > 0 && datesB.length > 0
        ? datesA[0].getTime() - datesB[0].getTime()
        : datesA.length === 0 && datesB.length === 0
          ? 0
          : datesA.length === 0
            ? 1
            : -1
    },
    header: ({ column }) => {
      return <DataTableColumnHeader column={column} title="Zaaidatum" />
    },
    enableHiding: true, // Enable hiding for mobile
    cell: ({ cell, row }) => {
      const dates = getRowDates(row, "b_lu_start")
      return !row.original.canModify ? (
        <DateRangeDisplay range={dates} emptyContent="Geen" />
      ) : (
        <TableDateSelector name="b_lu_start" row={row} cellId={cell.id} required={true} />
      )
    },
  }),
  // An accessor fn is needed to make the column appear as sortable
  columnHelper.accessor(() => null, {
    id: "b_lu_end",
    enableSorting: true,
    sortFn: (a, b) => {
      const datesA = getRowDates(a, "b_lu_end")
      const datesB = getRowDates(b, "b_lu_end")

      return datesA.length > 0 && datesB.length > 0
        ? datesA[datesA.length - 1].getTime() - datesB[datesB.length - 1].getTime()
        : datesA.length === 0 && datesB.length === 0
          ? 0
          : datesA.length === 0
            ? 1
            : -1
    },
    header: ({ column }) => {
      return <DataTableColumnHeader column={column} title="Einddatum" />
    },
    enableHiding: true, // Enable hiding for mobile
    cell: ({ cell, row }) => {
      const dates = getRowDates(row, "b_lu_end")
      if (!row.original.canModify) {
        return <DateRangeDisplay range={dates} emptyContent="Geen" />
      }
      const cultivation = (row.getParentRow() ?? row).original as CropRow
      const tooltipMessageNumHarvests =
        cultivation.b_lu_harvestable === "multiple"
          ? 0
          : (row.original.type === "crop" ? (row.subRows ?? []) : [row]).reduce(
              (sum, fieldRow) => sum + (fieldRow.original as FieldRow).harvests.length,
              0,
            )
      return cultivation.b_lu_harvestable !== "multiple" ? (
        <span className="whitespace-nowrap">
          <Tooltip>
            <TooltipTrigger>
              <DateRangeDisplay range={dates} emptyContent="Geen" />
            </TooltipTrigger>
            <TooltipContent>
              {tooltipMessageNumHarvests > 1
                ? `U zou in plaats daarvan de huidige ${getHarvestTerm(cultivation.b_lu_croprotation, true, cultivation.b_lu_harvestable)} bijwerken.`
                : tooltipMessageNumHarvests === 1
                  ? `U zou in plaats daarvan de huidige ${getHarvestTerm(cultivation.b_lu_croprotation, false, cultivation.b_lu_harvestable)} bijwerken.`
                  : `U zou in plaats daarvan een ${getHarvestTerm(cultivation.b_lu_croprotation, false, cultivation.b_lu_harvestable)} moeten toevoegen.`}
            </TooltipContent>
          </Tooltip>
        </span>
      ) : (
        <TableDateSelector name="b_lu_end" row={row} cellId={cell.id} required={false} />
      )
    },
  }),
  // An accessor fn is needed to make the column appear as sortable
  columnHelper.accessor(() => null, {
    id: "b_harvest_date",
    enableSorting: true,
    sortFn: (a, b) => {
      const datesA = getHarvestDates(a)
      const datesB = getHarvestDates(b)

      return datesA.length > 0 && datesB.length > 0
        ? datesA[0].getTime() - datesB[0].getTime()
        : datesA.length === 0 && datesB.length === 0
          ? 0
          : datesA.length === 0
            ? 1
            : -1
    },
    header: ({ column }) => {
      return <DataTableColumnHeader column={column} title="Oogst/Maaidata" />
    },
    enableHiding: true, // Enable hiding for mobile
    cell: ({ row }) => {
      return <HarvestDatesDisplay row={row} />
    },
  }),
  // An accessor fn is needed to make the column appear as sortable
  columnHelper.accessor(() => null, {
    id: "b_lu_variety",
    enableSorting: true,
    sortFn: (a, b) => {
      if (a.original.type === "crop" || b.original.type === "crop") return 0
      const varietyA = a.original.b_lu_variety.length > 0 ? a.original.b_lu_variety[0][0] : null
      const varietyB = b.original.b_lu_variety.length > 0 ? b.original.b_lu_variety[0][0] : null

      return varietyA !== null && varietyB !== null
        ? varietyA < varietyB
          ? -1
          : 1
        : varietyA === varietyB
          ? 0
          : varietyA === null
            ? 1
            : -1
    },
    header: ({ column }) => {
      return <DataTableColumnHeader column={column} title="Variëteit" />
    },
    enableHiding: true, // Enable hiding for mobile
    cell: ({ cell, row }) => (
      <TableVarietySelector
        name="b_lu_variety"
        row={row}
        cellId={cell.id}
        canModify={row.original.canModify}
      />
    ),
  }),
  columnHelper.display({
    id: "m_cropresidue",
    enableSorting: false,
    header: ({ column }) => {
      return <DataTableColumnHeader column={column} title="Gewasresten" />
    },
    enableHiding: true, // Enable hiding for mobile
    cell: (props) =>
      props.row.original.b_lu_croprotation === "cereal" && <CropResidueCheckbox {...props} />,
  }),
  columnHelper.display({
    id: "fertilizers",
    enableSorting: false,
    enableHiding: true, // Enable hiding for mobile
    header: ({ column }) => {
      return <DataTableColumnHeader column={column} title="Bemesting met:" />
    },
    cell: ({ row }) => {
      return <FertilizerDisplay row={row} />
    },
  }),
  columnHelper.display({
    id: "b_name",
    enableSorting: true,
    sortFn: (rowA, rowB, _columnId) => {
      const fieldA = rowA.original.fields?.length ?? 0
      const fieldB = rowB.original.fields?.length ?? 0
      return fieldA - fieldB
    },
    enableHiding: true, // Enable hiding for mobile
    header: ({ column }) => {
      return <DataTableColumnHeader column={column} title="Percelen" />
    },
    cell: ({ row }) => {
      const cultivation = row.original

      const fieldsDisplay = useMemo(() => {
        if (cultivation.type === "field") return null
        const fieldsSorted = (row.subRows ?? [])
          .map((row) => row.original as FieldRow)
          .sort((a, b) => a.b_name.localeCompare(b.b_name))
        return (
          cultivation.type === "crop" && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost">
                  <p className="text-muted-foreground">
                    {fieldsSorted.length === 1 ? "1 perceel" : `${fieldsSorted.length} percelen`}
                  </p>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <ScrollArea
                  className={fieldsSorted.length >= 8 ? "h-72 w-48 overflow-y-auto" : "w-48"}
                >
                  <div className="grid grid-cols-1 gap-2">
                    {fieldsSorted.map((field) => (
                      <NavLink
                        to={`../${cultivation.calendar}/field/${field.b_id}`}
                        key={`${field.b_id}`}
                      >
                        <DropdownMenuItem>{field.b_name}</DropdownMenuItem>
                      </NavLink>
                    ))}
                  </div>
                </ScrollArea>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        )
      }, [cultivation.type, cultivation.calendar, row.subRows])

      return fieldsDisplay
    },
  }),
  // This column needs an accessor function to indicate that it is sortable. TanStack Table seems
  // to make false assumptions if we simply give "b_area". We also need a sortFn to make sure we
  // sort based only on the fields that pass the filter.
  columnHelper.accessor(
    (row) =>
      row.type === "field"
        ? row.b_area
        : (row.fields ?? []).reduce((total, fieldRow) => total + (fieldRow as FieldRow).b_area, 0),
    {
      id: "b_area",
      enableSorting: true,
      sortFn: (rowA, rowB, _columnId) => getRowTotalArea(rowA) - getRowTotalArea(rowB),
      header: ({ column }) => {
        return <DataTableColumnHeader column={column} title="Oppervlakte" />
      },
      enableHiding: true, // Enable hiding for mobile
      cell: ({ row }) => {
        const b_area = getRowTotalArea(row)
        const formattedArea = b_area < 0.1 ? "< 0.1 ha" : `${b_area.toFixed(1)} ha`
        return <p className="text-muted-foreground">{formattedArea}</p>
      },
    },
  ),
])
