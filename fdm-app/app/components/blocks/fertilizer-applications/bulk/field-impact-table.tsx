import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, ChevronDown } from "lucide-react"
import { useMemo, useState } from "react"
import { NavLink } from "react-router"
import { computeAdviceProgress } from "~/components/blocks/nutrient-advice/progress-bar"
import { Button } from "~/components/ui/button"
import { Checkbox } from "~/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import { Skeleton } from "~/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"
import { cn } from "~/lib/utils"
import type { FieldImpactRow } from "./aggregate"
import type { BulkNormKey, BulkNutrient } from "./types"
import { CultivationBadge } from "./cultivation-badge"
import { InfoTip } from "./info-tip"
import { ComparisonLabel, FieldStatusLabel, formatKg, isDeviation } from "./status"

type SortKey = "name" | "area" | "crop" | "n" | "p" | "k" | "balance" | "status"

const NUTRIENT_HEADERS: Record<BulkNutrient, string> = { n: "N", p: "P₂O₅", k: "K₂O" }

/** Short column headers for the legal norms, with the full name for the tooltip. */
const NORM_HEADERS: Record<BulkNormKey, { short: string; full: string }> = {
  nitrogen: { short: "Norm N", full: "Gebruiksnorm stikstof, werkzaam" },
  phosphate: { short: "Norm P₂O₅", full: "Gebruiksnorm fosfaat" },
  manure: { short: "Norm N dierlijk", full: "Gebruiksnorm stikstof uit dierlijke mest" },
  renure: { short: "Norm RENURE", full: "Gebruiksnorm RENURE" },
}

/** Sort options for the card view, which has no column headers. */
const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "name:asc", label: "Naam" },
  { value: "status:desc", label: "Aandachtspunten eerst" },
  { value: "balance:desc", label: "Hoogste N-balans" },
  { value: "n:desc", label: "Meeste N t.o.v. advies" },
  { value: "area:desc", label: "Grootste oppervlakte" },
]

/** The columns that can be shown or hidden; the field name is always shown. */
type ColumnKey = "area" | "crop" | BulkNutrient | "balance" | BulkNormKey | "status"

const NORM_KEYS: BulkNormKey[] = ["nitrogen", "phosphate", "manure", "renure"]

/** The columns other than the norms, in order; the norms are placed before the status. */
const BASE_COLUMNS = ["area", "crop", "n", "p", "k", "balance", "status"] as const

const COLUMN_LABELS: Record<(typeof BASE_COLUMNS)[number], string> = {
  area: "Oppervlakte",
  crop: "Gewas",
  n: "N (werkzaam)",
  p: "P₂O₅",
  k: "K₂O",
  balance: "N-balans",
  status: "Status",
}

function sortValue(row: FieldImpactRow, key: SortKey): number | string {
  switch (key) {
    case "name":
      return row.b_name.toLocaleLowerCase("nl-NL")
    case "area":
      return row.b_area
    case "crop":
      return (row.mainCultivationName ?? "").toLocaleLowerCase("nl-NL")
    case "n":
    case "p":
    case "k": {
      const dose = row.doseAfter ?? row.dose
      const advice = row.advice?.[key]
      if (!dose || advice === undefined) return Number.NEGATIVE_INFINITY
      return advice > 0 ? dose[key] / advice : dose[key] > 0 ? Number.POSITIVE_INFINITY : 0
    }
    case "balance": {
      const balance = row.balanceAfter ?? row.balance
      return balance ? balance.balance - balance.target : Number.NEGATIVE_INFINITY
    }
    case "status":
      return row.statuses.filter(isDeviation).length
  }
}

function SortableHead({
  label,
  sortKey,
  sort,
  onSort,
  className,
}: {
  label: string
  sortKey: SortKey
  sort: { key: SortKey; desc: boolean }
  onSort: (key: SortKey) => void
  className?: string
}) {
  const active = sort.key === sortKey
  const Icon = active ? (sort.desc ? ArrowDown : ArrowUp) : ArrowUpDown
  return (
    <TableHead
      className={className}
      aria-sort={active ? (sort.desc ? "descending" : "ascending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "hover:text-foreground inline-flex items-center gap-1 whitespace-nowrap",
          active && "text-foreground",
        )}
      >
        {label}
        <Icon className="size-3" aria-hidden="true" />
      </button>
    </TableHead>
  )
}

function NutrientCell({ row, nutrient }: { row: FieldImpactRow; nutrient: BulkNutrient }) {
  const dose = (row.included ? row.doseAfter : undefined) ?? row.dose
  const advice = row.advice?.[nutrient]
  if (!dose || advice === undefined) {
    return <span className="text-muted-foreground">–</span>
  }
  const { status } = computeAdviceProgress(dose[nutrient], advice)
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap tabular-nums">
      <span>
        <span className={cn(row.included && row.doseAfter && "font-semibold")}>
          {formatKg(dose[nutrient])}
        </span>
        <span className="text-muted-foreground"> / {formatKg(advice)}</span>
      </span>
      <ComparisonLabel status={status} noun="advies" />
    </span>
  )
}

function BalanceCell({ row }: { row: FieldImpactRow }) {
  const balance = (row.included ? row.balanceAfter : undefined) ?? row.balance
  if (!balance) return <span className="text-muted-foreground">–</span>
  const isOver = balance.balance > balance.target
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap tabular-nums">
      <span>
        <span className={cn(row.included && row.balanceAfter && "font-semibold")}>
          {formatKg(balance.balance)}
        </span>
        <span className="text-muted-foreground"> / {formatKg(balance.target)}</span>
      </span>
      <ComparisonLabel status={isOver ? "over" : "on-target"} noun="streefwaarde" />
    </span>
  )
}

function NormCell({ row, normKey }: { row: FieldImpactRow; normKey: BulkNormKey }) {
  const norm = row.norms?.[normKey]
  const filling =
    (row.included ? row.normFillingsAfter?.[normKey] : undefined) ?? row.normFillings?.[normKey]
  if (norm === undefined || filling === undefined) {
    return <span className="text-muted-foreground">–</span>
  }
  const isOver = norm > 0 ? filling > norm : filling > 0
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap tabular-nums">
      <span>
        <span className={cn(row.included && row.normFillingsAfter && "font-semibold")}>
          {formatKg(filling)}
        </span>
        <span className="text-muted-foreground"> / {formatKg(norm)}</span>
      </span>
      <ComparisonLabel status={isOver ? "over" : "on-target"} noun="gebruiksnorm" />
    </span>
  )
}

const NUTRIENT_NAMES: Record<BulkNutrient, string> = { n: "N", p: "P₂O₅", k: "K₂O" }

/** Warning for a field that does not have the crop selected in the rotation table. */
function CropWarning() {
  const text = "Dit perceel heeft het geselecteerde gewas niet"
  return (
    <InfoTip content={text}>
      <button type="button" aria-label={text} className="-m-1 shrink-0 rounded-sm p-1">
        <AlertTriangle className="size-4 text-amber-600" aria-hidden="true" />
      </button>
    </InfoTip>
  )
}

/** The status labels of a row, with the nutrients concerned and the explanation in a tooltip. */
function StatusCell({ row }: { row: FieldImpactRow }) {
  const extra = row.messages.join(" ") || undefined
  return (
    <span className="flex flex-wrap gap-x-2 gap-y-0.5">
      {row.statuses.map((status) => (
        <FieldStatusLabel
          key={status}
          status={status}
          detail={
            status === "under_advice"
              ? row.adviceNutrients.under.map((n) => NUTRIENT_NAMES[n]).join(", ")
              : status === "over_advice"
                ? row.adviceNutrients.over.map((n) => NUTRIENT_NAMES[n]).join(", ")
                : undefined
          }
          extra={
            status === "missing_soil_data" || status === "no_advice" || status === "no_balance"
              ? extra
              : undefined
          }
        />
      ))}
    </span>
  )
}

/**
 * The per-field breakdown of the bulk fertilizer application page.
 *
 * Each row can be excluded from the application. Excluded fields are also left out of the advice
 * and nitrogen balance aggregation, but stay visible so they can be included again. Values show
 * the dose and balance after the application when a preview is available.
 *
 * The legal norms of each field (indicative per field) can be shown as extra columns.
 *
 * @param props.normKeys - The norms that can be shown as columns; empty for years without norms.
 */
export function FieldImpactTable({
  rows,
  loading,
  b_id_farm,
  calendar,
  onSetIncluded,
  disabled,
  selectable = true,
  normKeys = [],
}: {
  rows: FieldImpactRow[]
  loading: boolean
  b_id_farm: string
  calendar: string
  /** Includes or excludes the given fields. Not used when `selectable` is `false`. */
  onSetIncluded?: (b_ids: string[], included: boolean) => void
  disabled?: boolean
  /** Show a checkbox per field to include or exclude it. */
  selectable?: boolean
  normKeys?: BulkNormKey[]
}) {
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "name", desc: false })
  // The legal norms are hidden by default; every other column is shown
  const [hidden, setHidden] = useState<Set<ColumnKey>>(() => new Set(NORM_KEYS))
  const columns: ColumnKey[] = [
    ...BASE_COLUMNS.slice(0, -1),
    ...normKeys,
    "status" as const,
  ].filter((key) => !hidden.has(key))
  const isShown = (key: ColumnKey) => columns.includes(key)
  const toggleColumn = (key: ColumnKey, show: boolean) =>
    setHidden((prev) => {
      const next = new Set(prev)
      if (show) next.delete(key)
      else next.add(key)
      return next
    })
  const shownNormKeys = normKeys.filter((key) => isShown(key))

  const handleSort = (key: SortKey) =>
    setSort((prev) => ({ key, desc: prev.key === key ? !prev.desc : key !== "name" }))

  const visibleRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const va = sortValue(a, sort.key)
      const vb = sortValue(b, sort.key)
      const order =
        typeof va === "string" && typeof vb === "string"
          ? va.localeCompare(vb, "nl-NL")
          : Number(va) - Number(vb)
      return (sort.desc ? -order : order) || a.b_name.localeCompare(b.b_name, "nl-NL")
    })
  }, [rows, sort])

  const allIncluded = rows.length > 0 && rows.every((row) => row.included)
  const someIncluded = rows.some((row) => row.included)

  return (
    <section aria-label="Percelen" className="@container/fields space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Percelen</h3>
          <p className="text-muted-foreground text-xs">
            {selectable
              ? "Waarden na deze gift, in kg per ha. Vink een perceel uit om het over te slaan. Wijs een status aan voor uitleg."
              : "Waarden na de wijziging, in kg per ha."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* The cards have no column headers, so sorting gets its own control there */}
          <Select
            value={`${sort.key}:${sort.desc ? "desc" : "asc"}`}
            onValueChange={(value) => {
              const [key, direction] = value.split(":") as [SortKey, string]
              setSort({ key, desc: direction === "desc" })
            }}
          >
            <SelectTrigger className="h-8 w-auto @xl/fields:hidden" aria-label="Sorteren">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Kolommen
                <ChevronDown className="size-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Kolommen tonen</DropdownMenuLabel>
              {BASE_COLUMNS.slice(0, -1).map((key) => (
                <DropdownMenuCheckboxItem
                  key={key}
                  checked={isShown(key)}
                  onSelect={(event) => event.preventDefault()}
                  onCheckedChange={(checked) => toggleColumn(key, checked === true)}
                >
                  {COLUMN_LABELS[key]}
                </DropdownMenuCheckboxItem>
              ))}
              {normKeys.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
                    Gebruiksnormen (per perceel indicatief)
                  </DropdownMenuLabel>
                  {normKeys.map((key) => (
                    <DropdownMenuCheckboxItem
                      key={key}
                      checked={isShown(key)}
                      onSelect={(event) => event.preventDefault()}
                      onCheckedChange={(checked) => toggleColumn(key, checked === true)}
                    >
                      {NORM_HEADERS[key].full}
                    </DropdownMenuCheckboxItem>
                  ))}
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={isShown("status")}
                onSelect={(event) => event.preventDefault()}
                onCheckedChange={(checked) => toggleColumn("status", checked === true)}
              >
                {COLUMN_LABELS.status}
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {/* Narrow containers (phones) get a card per field instead of a wide table */}
      <ul className="divide-y rounded-md border @xl/fields:hidden">
        {visibleRows.map((row) => (
          <li
            key={row.b_id}
            className={cn("space-y-3 p-3", !row.included && "text-muted-foreground")}
          >
            <div className="flex items-start gap-3">
              {selectable && (
                <Checkbox
                  aria-label={`${row.b_name} meenemen`}
                  className="mt-0.5 size-5"
                  checked={row.included}
                  disabled={disabled}
                  onCheckedChange={(checked) => onSetIncluded?.([row.b_id], checked === true)}
                />
              )}
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <NavLink
                    to={`/farm/${b_id_farm}/${calendar}/field/${row.b_id}/fertilizer`}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {row.b_name}
                  </NavLink>
                  {!row.hasSelectedCrop && <CropWarning />}
                  {isShown("area") && (
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {row.b_area.toLocaleString("nl-NL")} ha
                    </span>
                  )}
                </div>
                {isShown("crop") && row.mainCultivationName && (
                  <CultivationBadge
                    name={row.mainCultivationName}
                    cropRotation={row.mainCultivationCropRotation}
                  />
                )}
              </div>
            </div>
            {loading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  {(["n", "p", "k"] as const)
                    .filter((nutrient) => isShown(nutrient))
                    .map((nutrient) => (
                      <div key={nutrient}>
                        <dt className="text-muted-foreground">{COLUMN_LABELS[nutrient]}</dt>
                        <dd className="text-sm">
                          <NutrientCell row={row} nutrient={nutrient} />
                        </dd>
                      </div>
                    ))}
                  {isShown("balance") && (
                    <div>
                      <dt className="text-muted-foreground">{COLUMN_LABELS.balance}</dt>
                      <dd className="text-sm">
                        <BalanceCell row={row} />
                      </dd>
                    </div>
                  )}
                  {shownNormKeys.map((key) => (
                    <div key={key}>
                      <dt className="text-muted-foreground">{NORM_HEADERS[key].short}</dt>
                      <dd className="text-sm">
                        <NormCell row={row} normKey={key} />
                      </dd>
                    </div>
                  ))}
                </dl>
                {isShown("status") && <StatusCell row={row} />}
              </>
            )}
          </li>
        ))}
        {visibleRows.length === 0 && (
          <li className="text-muted-foreground p-4 text-center text-sm">
            Geen percelen geselecteerd.
          </li>
        )}
      </ul>
      <div className="hidden overflow-x-auto rounded-md border @xl/fields:block">
        <Table>
          <TableHeader>
            <TableRow>
              {selectable && (
                <TableHead className="w-10">
                  <Checkbox
                    aria-label="Alle percelen meenemen"
                    checked={allIncluded ? true : someIncluded ? "indeterminate" : false}
                    disabled={disabled}
                    onCheckedChange={(checked) =>
                      onSetIncluded?.(
                        rows.map((row) => row.b_id),
                        checked === true,
                      )
                    }
                  />
                </TableHead>
              )}
              <SortableHead label="Perceel" sortKey="name" sort={sort} onSort={handleSort} />
              {isShown("area") && (
                <SortableHead
                  label="Oppervlakte"
                  sortKey="area"
                  sort={sort}
                  onSort={handleSort}
                  className="text-right"
                />
              )}
              {isShown("crop") && (
                <SortableHead label="Gewas" sortKey="crop" sort={sort} onSort={handleSort} />
              )}
              {(["n", "p", "k"] as const)
                .filter((nutrient) => isShown(nutrient))
                .map((nutrient) => (
                  <SortableHead
                    key={nutrient}
                    label={NUTRIENT_HEADERS[nutrient]}
                    sortKey={nutrient}
                    sort={sort}
                    onSort={handleSort}
                  />
                ))}
              {isShown("balance") && (
                <SortableHead label="N-balans" sortKey="balance" sort={sort} onSort={handleSort} />
              )}
              {shownNormKeys.map((key) => (
                <TableHead key={key} className="whitespace-nowrap">
                  <InfoTip
                    content={`${NORM_HEADERS[key].full}, in kg per ha. Per perceel indicatief; wettelijk telt het bedrijfstotaal.`}
                  >
                    <button
                      type="button"
                      className="cursor-help underline decoration-dotted underline-offset-4"
                    >
                      {NORM_HEADERS[key].short}
                    </button>
                  </InfoTip>
                </TableHead>
              ))}
              {isShown("status") && (
                <SortableHead label="Status" sortKey="status" sort={sort} onSort={handleSort} />
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRows.map((row) => (
              <TableRow
                key={row.b_id}
                // Excluded fields are dimmed; included fields keep the normal background for contrast
                className={cn(!row.included && "text-muted-foreground")}
              >
                {selectable && (
                  <TableCell>
                    <Checkbox
                      aria-label={`${row.b_name} meenemen`}
                      checked={row.included}
                      disabled={disabled}
                      onCheckedChange={(checked) => onSetIncluded?.([row.b_id], checked === true)}
                    />
                  </TableCell>
                )}
                <TableCell className="max-w-48">
                  <span className="flex items-center gap-1.5">
                    <NavLink
                      to={`/farm/${b_id_farm}/${calendar}/field/${row.b_id}/fertilizer`}
                      className="truncate font-medium underline-offset-4 hover:underline"
                    >
                      {row.b_name}
                    </NavLink>
                    {!row.hasSelectedCrop && <CropWarning />}
                  </span>
                </TableCell>
                {isShown("area") && (
                  <TableCell className="text-right whitespace-nowrap tabular-nums">
                    {row.b_area.toLocaleString("nl-NL")} ha
                  </TableCell>
                )}
                {isShown("crop") && (
                  <TableCell className="max-w-40">
                    {row.mainCultivationName ? (
                      <CultivationBadge
                        name={row.mainCultivationName}
                        cropRotation={row.mainCultivationCropRotation}
                      />
                    ) : (
                      <span className="text-muted-foreground">–</span>
                    )}
                  </TableCell>
                )}
                {(["n", "p", "k"] as const)
                  .filter((nutrient) => isShown(nutrient))
                  .map((nutrient) => (
                    <TableCell key={nutrient}>
                      {loading ? (
                        <Skeleton className="h-4 w-16" />
                      ) : (
                        <NutrientCell row={row} nutrient={nutrient} />
                      )}
                    </TableCell>
                  ))}
                {isShown("balance") && (
                  <TableCell>
                    {loading ? <Skeleton className="h-4 w-16" /> : <BalanceCell row={row} />}
                  </TableCell>
                )}
                {shownNormKeys.map((key) => (
                  <TableCell key={key}>
                    {loading ? (
                      <Skeleton className="h-4 w-16" />
                    ) : (
                      <NormCell row={row} normKey={key} />
                    )}
                  </TableCell>
                ))}
                {isShown("status") && (
                  <TableCell>
                    {loading ? <Skeleton className="h-4 w-20" /> : <StatusCell row={row} />}
                  </TableCell>
                )}
              </TableRow>
            ))}
            {visibleRows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={(selectable ? 2 : 1) + columns.length}
                  className="text-muted-foreground h-16 text-center"
                >
                  Geen percelen geselecteerd.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}
