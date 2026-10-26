import { aggregateNutrientAdviceToFarmLevel } from "@nmi-agro/fdm-calculator/browser"
import { createColumnHelper, type Column, type ColumnDef } from "@tanstack/react-table"
import { ArrowDown, ArrowUp } from "lucide-react"
import { NavLink } from "react-router"
import { CultivationSuggestionBadge } from "~/components/blocks/cultivation/suggestion"
import { getCultivationColor } from "~/components/custom/cultivation-colors"
import { Badge } from "~/components/ui/badge"
import { Skeleton } from "~/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip"
import { cn } from "~/lib/utils"
import type { FieldNutrientRow, UnitMode } from "./overview-types"
import type { NutrientDescription } from "./types"
import { overviewTableFeatures } from "./overview-table-features"
import {
  ADVICE_STATUS_TEXT_CLASSES,
  type AdviceProgressStatus,
  computeAdviceProgress,
} from "./progress-bar"

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
  /** Applied-vs-advice class from `computeAdviceProgress`; `null` when there is no meaningful data. */
  status: AdviceProgressStatus | null
}

/**
 * Classifies a nutrient's filling against its advice, with the same thresholds as the progress
 * bars and the Atlas map (`computeAdviceProgress`). advice === 0 with filling === 0 means no
 * meaningful data was available; advice === 0 with filling > 0 is real over-fertilization (there
 * was no room for any filling at all), not missing data.
 */
function getNutrientStatus(
  nutrientSymbol: string,
  filling: number,
  advice: number,
): NutrientStatus {
  if (advice === 0 && filling === 0) {
    return { percentage: 0, status: null }
  }

  // EOC (organic carbon) is excluded from excess flagging: a surplus is agronomically beneficial, not a risk.
  const { status } = computeAdviceProgress(filling, advice, nutrientSymbol === "EOC")
  // Positive filling with zero advice sorts above any finite percentage.
  const percentage = advice === 0 ? Infinity : (filling / advice) * 100
  return { percentage, status }
}

function NutrientColumnHeader({
  column,
  nutrient,
  unitMode,
}: {
  column: Column<typeof overviewTableFeatures, FieldNutrientRow, unknown>
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
          <span className="text-xs leading-none font-normal">
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

  if (row.pending) {
    return (
      <span className="flex justify-end">
        <Skeleton className="h-4 w-14" />
      </span>
    )
  }

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
  const { status } = getNutrientStatus(nutrient.symbol, filling, advice)

  return (
    <span className="flex items-center justify-end gap-1 whitespace-nowrap tabular-nums">
      <span className={cn(status && ADVICE_STATUS_TEXT_CLASSES[status])}>
        {formatValue(filling)}
      </span>
      <span className="text-foreground">/ {formatValue(advice)}</span>
    </span>
  )
}

function buildNutrientColumn(
  nutrient: NutrientDescription,
  unitMode: UnitMode,
  complete: boolean,
): ColumnDef<typeof overviewTableFeatures, FieldNutrientRow> {
  return {
    id: nutrient.symbol,
    accessorFn: (row) => {
      const value = row.values[nutrient.symbol]
      if (row.errorMessage || !value) return -1
      const status = getNutrientStatus(nutrient.symbol, value.filling, value.advice)
      return status.status ? status.percentage : -1
    },
    enableHiding: true,
    header: ({ column }) => (
      <NutrientColumnHeader column={column} nutrient={nutrient} unitMode={unitMode} />
    ),
    cell: ({ row }) => <NutrientCell row={row.original} nutrient={nutrient} unitMode={unitMode} />,
    footer: ({ table }) => {
      // The farm average or total is only meaningful once every field's advice has arrived.
      if (!complete) {
        return (
          <span className="flex justify-end">
            <Skeleton className="h-4 w-14" />
          </span>
        )
      }

      const fields = table
        .getFilteredRowModel()
        .rows.map((r) => r.original)
        .filter((r) => !r.errorMessage)
        .map((r) => {
          const value = r.values[nutrient.symbol]
          return {
            b_area: r.b_area || 0,
            values: value
              ? { [nutrient.symbol]: { dose: value.filling, advice: value.advice } }
              : {},
          }
        })

      const { dose, advice } = aggregateNutrientAdviceToFarmLevel(
        fields,
        [nutrient.symbol],
        unitMode,
      )[nutrient.symbol]

      return (
        <span className="flex justify-end whitespace-nowrap tabular-nums">
          {formatValue(dose)} / {formatValue(advice)}
        </span>
      )
    },
  }
}

function FieldColumnHeader({
  column,
}: {
  column: Column<typeof overviewTableFeatures, FieldNutrientRow, unknown>
}) {
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

/**
 * Label of the farm summary row. In "per ha" mode the row is an area-weighted average, not a
 * total, so the label says so; the tooltip explains how the numbers are calculated.
 */
function FarmSummaryLabel({ unitMode }: { unitMode: UnitMode }) {
  const isTotal = unitMode === "total"
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="flex flex-col items-start gap-0.5 text-left">
          <span className="font-medium">{isTotal ? "Bedrijfstotaal" : "Bedrijfsgemiddelde"}</span>
          <span className="text-muted-foreground text-xs leading-none font-normal">
            {isTotal ? "alle percelen samen" : "gewogen per ha"}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p className="text-xs">
          {isTotal
            ? "Totale hoeveelheid in kg voor alle percelen samen (advies per ha × oppervlakte)."
            : "Gemiddelde per hectare, gewogen naar de oppervlakte van de percelen. Kies 'Totaal' voor de totale hoeveelheid in kg voor het bedrijf."}{" "}
          Percelen zonder advies tellen niet mee.
        </p>
      </TooltipContent>
    </Tooltip>
  )
}

/**
 * Builds the "Perceel" column, with the farm summary label in its footer.
 *
 * @param b_id_farm ID of the farm to be used for links.
 * @param calendar Current calendar to be used for links.
 * @param unitMode Whether the farm row shows the area-weighted average per ha or the farm total.
 */
export function buildFieldColumn(
  b_id_farm: string,
  calendar: string,
  unitMode: UnitMode,
): ColumnDef<typeof overviewTableFeatures, FieldNutrientRow> {
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
    footer: () => <FarmSummaryLabel unitMode={unitMode} />,
  }
}

const columnHelper = createColumnHelper<typeof overviewTableFeatures, FieldNutrientRow>()

const typeOrder = ["primary", "secondary", "trace"] as const
/**
 * Builds column groups for each nutrient type. Also include a standalone column for field.
 *
 * The field column's header will spawn 2 rows this way. We just ignore the row span value for
 * the footer, but that also spans 2 rows.
 *
 * @param nutrients Nutrient descriptions for the nutrients displayed on the table.
 * @param unitMode Whether to display per-ha or total nutrient advice on the table.
 * @param b_id_farm ID of the farm to be used for links.
 * @param calendar Current calendar to be used for links.
 * @param complete Whether every field's advice has arrived; until then the farm row shows a
 * placeholder.
 */
export function buildOverviewColumns(
  nutrients: NutrientDescription[],
  unitMode: UnitMode,
  b_id_farm: string,
  calendar: string,
  complete: boolean,
) {
  type ColGroup = ReturnType<typeof columnHelper.group>
  const fieldColumns = columnHelper.columns([buildFieldColumn(b_id_farm, calendar, unitMode)])

  const nutrientColumns = columnHelper.columns(
    typeOrder.map((type) =>
      columnHelper.group({ id: `type_${type}`, header: GROUP_LABELS[type], columns: [] }),
    ),
  )
  const nutrientColumnsMap = Object.fromEntries(
    nutrientColumns.map((col, i) => [typeOrder[i] as string, col]),
  ) as Record<string, ColGroup>

  for (const nutrient of nutrients) {
    let group = nutrientColumnsMap[nutrient.type]
    if (typeof group === "undefined") {
      continue
    }
    ;(group.columns as any[]).push(buildNutrientColumn(nutrient, unitMode, complete))
  }

  return [...fieldColumns, ...nutrientColumns]
}
