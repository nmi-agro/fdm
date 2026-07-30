import type { Column, ColumnDef, RowData } from "@tanstack/react-table"
import { ArrowDown, ArrowUp } from "lucide-react"
import { NavLink } from "react-router"
import { CultivationSuggestionBadge } from "~/components/blocks/cultivation/suggestion"
import { getCultivationColor } from "~/components/custom/cultivation-colors"
import { Badge } from "~/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip"
import { cn } from "~/lib/utils"
import type { FieldNutrientRow, UnitMode } from "./overview-types"
import type { NutrientDescription } from "./types"

// Lets each nutrient column carry its group ("Primair" etc.) for the divider styling and the
// "Bekijk" column-visibility dropdown, without needing a nested (and fragile) grouped header row.
declare module "@tanstack/react-table" {
  interface ColumnMeta<TData extends RowData, TValue> {
    groupStart?: boolean
    groupLabel?: string
  }
}

// A field is considered under-fertilized below this % of advice, and over-fertilized at or above it.
const DEFICIT_THRESHOLD = 90
const EXCESS_THRESHOLD = 105

export const GROUP_LABELS: Record<NutrientDescription["type"], string> = {
  primary: "Primair",
  secondary: "Secundair",
  trace: "Sporenelementen",
}

function formatValue(value: number) {
  if (!Number.isFinite(value) || value === 0) return "0"
  return value >= 1 ? Math.round(value).toLocaleString("nl-NL") : value.toPrecision(2)
}

/** Strips the "/ha" suffix from a unit string when displaying farm/field totals instead of per-hectare rates. */
function formatUnit(unit: string, unitMode: UnitMode) {
  return unitMode === "total" ? unit.replace(/\/ha$/, "") : unit
}

interface NutrientStatus {
  /** Fill percentage relative to advice. Also used as the sortable value: real over-fertilization
   * (zero advice, positive filling) is reported as Infinity so it sorts above any finite percentage. */
  percentage: number
  hasData: boolean
  isExcess: boolean
  isDeficit: boolean
  isCorrect: boolean
}

/**
 * Classifies a nutrient's filling against its advice. advice === 0 with filling === 0 means no
 * meaningful data was available; advice === 0 with filling > 0 is real over-fertilization (there
 * was no room for any filling at all), not missing data.
 */
function getNutrientStatus(
  nutrientSymbol: string,
  filling: number,
  advice: number,
): NutrientStatus {
  if (advice === 0 && filling === 0) {
    return { percentage: 0, hasData: false, isExcess: false, isDeficit: false, isCorrect: false }
  }

  if (advice === 0) {
    // Positive filling with zero advice: no room was available, so this is an excess by definition.
    return {
      percentage: Infinity,
      hasData: true,
      isExcess: true,
      isDeficit: false,
      isCorrect: false,
    }
  }

  const percentage = (filling / advice) * 100
  // EOC (organic carbon) is excluded from excess flagging: a surplus is agronomically beneficial, not a risk.
  const isExcess = nutrientSymbol !== "EOC" && percentage >= EXCESS_THRESHOLD
  const isDeficit = percentage < DEFICIT_THRESHOLD
  const isCorrect = !isExcess && !isDeficit
  return { percentage, hasData: true, isExcess, isDeficit, isCorrect }
}

function NutrientColumnHeader({
  column,
  nutrient,
  unitMode,
}: {
  column: Column<FieldNutrientRow, unknown>
  nutrient: NutrientDescription
  unitMode: UnitMode
}) {
  const sorted = column.getIsSorted()
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => column.toggleSorting(sorted === "asc")}
          className="text-muted-foreground hover:text-foreground flex w-full flex-col items-end gap-0.5 text-right whitespace-nowrap transition-colors"
        >
          <span className="flex items-center gap-1 font-medium">
            {nutrient.symbol}
            {sorted === "asc" ? (
              <ArrowUp className="h-3 w-3" />
            ) : sorted === "desc" ? (
              <ArrowDown className="h-3 w-3" />
            ) : null}
          </span>
          <span className="text-[10px] leading-none font-normal">
            {formatUnit(nutrient.unit, unitMode)}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <p className="font-medium">{nutrient.name}</p>
        <p className="text-xs">
          Vulling / advies &middot; klik om te sorteren op vullingspercentage
        </p>
      </TooltipContent>
    </Tooltip>
  )
}

function NutrientCell({
  row,
  nutrient,
  unitMode,
}: {
  row: FieldNutrientRow
  nutrient: NutrientDescription
  unitMode: UnitMode
}) {
  const value = row.values[nutrient.symbol]

  if (row.errorMessage || !value) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-muted-foreground block text-right">–</span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">Advies niet beschikbaar</p>
          <p className="text-xs">
            {row.errorMessage ?? "Geen advieswaarde beschikbaar voor dit nutriënt."}
          </p>
        </TooltipContent>
      </Tooltip>
    )
  }

  const area = row.b_area || 0
  const filling = unitMode === "total" ? value.filling * area : value.filling
  const advice = unitMode === "total" ? value.advice * area : value.advice
  const { isExcess, isDeficit, isCorrect } = getNutrientStatus(nutrient.symbol, filling, advice)

  return (
    <span className="flex items-center justify-end gap-1 whitespace-nowrap tabular-nums">
      <span
        className={cn(
          isExcess && "text-amber-600 dark:text-amber-500",
          isDeficit && "text-red-600 dark:text-red-500",
          isCorrect && "text-green-600 dark:text-green-500",
        )}
      >
        {formatValue(filling)}
      </span>
      <span className="text-foreground">/ {formatValue(advice)}</span>
    </span>
  )
}

function buildNutrientColumn(
  nutrient: NutrientDescription,
  unitMode: UnitMode,
  isGroupStart: boolean,
): ColumnDef<FieldNutrientRow> {
  return {
    id: nutrient.symbol,
    accessorFn: (row) => {
      const value = row.values[nutrient.symbol]
      if (row.errorMessage || !value) return -1
      const status = getNutrientStatus(nutrient.symbol, value.filling, value.advice)
      return status.hasData ? status.percentage : -1
    },
    enableHiding: true,
    meta: { groupStart: isGroupStart, groupLabel: GROUP_LABELS[nutrient.type] },
    header: ({ column }) => (
      <NutrientColumnHeader column={column} nutrient={nutrient} unitMode={unitMode} />
    ),
    cell: ({ row }) => <NutrientCell row={row.original} nutrient={nutrient} unitMode={unitMode} />,
    footer: ({ table }) => {
      const rows = table
        .getFilteredRowModel()
        .rows.map((r) => r.original)
        .filter((r) => !r.errorMessage && r.values[nutrient.symbol])

      const totalArea = rows.reduce((sum, r) => sum + (r.b_area || 0), 0)
      let fillingSum = 0
      let adviceSum = 0
      for (const r of rows) {
        const value = r.values[nutrient.symbol]
        if (!value) continue
        fillingSum += value.filling * (r.b_area || 0)
        adviceSum += value.advice * (r.b_area || 0)
      }

      const filling = unitMode === "total" ? fillingSum : totalArea > 0 ? fillingSum / totalArea : 0
      const advice = unitMode === "total" ? adviceSum : totalArea > 0 ? adviceSum / totalArea : 0

      return (
        <span className="flex justify-end whitespace-nowrap tabular-nums">
          {formatValue(filling)} / {formatValue(advice)}
        </span>
      )
    },
  }
}

function FieldColumnHeader({ column }: { column: Column<FieldNutrientRow, unknown> }) {
  const sorted = column.getIsSorted()
  return (
    <button
      type="button"
      onClick={() => {
        // Cycles asc -> desc -> clear, so a third click on "Perceel" resets sorting back to the
        // default (unsorted) row order instead of only ever toggling between asc/desc.
        if (sorted === "asc") {
          column.toggleSorting(true)
        } else if (sorted === "desc") {
          column.clearSorting()
        } else {
          column.toggleSorting(false)
        }
      }}
      className="text-muted-foreground hover:text-foreground flex items-center gap-1 font-medium transition-colors"
    >
      Perceel
      {sorted === "asc" ? (
        <ArrowUp className="h-3 w-3" />
      ) : sorted === "desc" ? (
        <ArrowDown className="h-3 w-3" />
      ) : null}
    </button>
  )
}

export function buildFieldColumn(b_id_farm: string, calendar: string): ColumnDef<FieldNutrientRow> {
  return {
    id: "field",
    accessorKey: "b_name",
    enableHiding: false,
    enableSorting: true,
    header: ({ column }) => <FieldColumnHeader column={column} />,
    cell: ({ row }) => {
      const field = row.original
      const cultivation = field.mainCultivation
      return (
        <div>
          <NavLink
            to={`./${field.b_id}${cultivation ? `?cultivation=${cultivation.b_lu}` : ""}`}
            className="group block max-w-[16rem]"
          >
            <span
              title={field.b_name}
              className="group-hover:text-foreground/80 block truncate font-medium underline-offset-4 group-hover:underline"
            >
              {field.b_name}
            </span>
            <span className="mt-1 flex min-w-0 items-center gap-2">
              <span className="text-muted-foreground shrink-0 text-xs">
                {field.b_area < 0.1 ? "< 0.1 ha" : `${field.b_area.toFixed(1)} ha`}
              </span>
              {cultivation ? (
                <Badge
                  title={cultivation.b_lu_name}
                  style={{
                    backgroundColor: getCultivationColor(
                      cultivation.b_lu_croprotation ?? undefined,
                    ),
                  }}
                  className="min-w-0 truncate text-white"
                  variant="default"
                >
                  {cultivation.b_lu_name}
                </Badge>
              ) : (
                <span className="text-muted-foreground truncate text-xs italic">Geen gewas</span>
              )}
            </span>
          </NavLink>
          {field.cultivationSuggestion && (
            <div className="mt-1" data-prevent-row-click="true">
              <CultivationSuggestionBadge
                b_id_farm={b_id_farm}
                calendar={calendar}
                b_id={field.b_id}
                suggestion={field.cultivationSuggestion}
              />
            </div>
          )}
        </div>
      )
    },
    footer: () => <span className="font-medium">Bedrijfstotaal</span>,
  }
}

/**
 * Flat (non-nested) column list: field name + one column per nutrient, ordered
 * Primair / Secundair / Sporenelementen. A nested header-group row was tried first but
 * broke sticky-column alignment; grouping is instead conveyed via a left divider on each
 * group's first column, the header tooltip, and the "Bekijk" dropdown's group labels.
 */
export function buildOverviewColumns(
  nutrients: NutrientDescription[],
  unitMode: UnitMode,
  b_id_farm: string,
  calendar: string,
): ColumnDef<FieldNutrientRow>[] {
  const order: NutrientDescription["type"][] = ["primary", "secondary", "trace"]
  const orderedNutrients = order.flatMap((type) =>
    nutrients.filter((nutrient) => nutrient.type === type),
  )

  let previousType: NutrientDescription["type"] | null = null
  const nutrientColumns = orderedNutrients.map((nutrient) => {
    const isGroupStart = nutrient.type !== previousType
    previousType = nutrient.type
    return buildNutrientColumn(nutrient, unitMode, isGroupStart)
  })

  return [buildFieldColumn(b_id_farm, calendar), ...nutrientColumns]
}
