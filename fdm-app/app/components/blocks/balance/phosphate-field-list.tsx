import type { PhosphateBalanceFieldResult } from "@nmi-agro/fdm-calculator"
import type { ReactNode } from "react"
import {
  PHOSPHATE_VERDICT_ORDER,
  type PhosphateBalanceField,
  type PhosphateStatus,
} from "@nmi-agro/fdm-calculator/browser"
import { ArrowDownRight, ArrowRight, ArrowUpRight, OctagonAlert } from "lucide-react"
import { NavLink } from "react-router"
import type { PhosphateFieldSortKey } from "~/lib/phosphate-field-list"
import { TableCell, TableRow } from "~/components/ui/table"
import {
  describePhosphateDirection,
  formatAreaHa,
  formatNumberNl,
  formatPhosphateAim,
  formatYearsBand,
  formatYearsClass,
  PHOSPHATE_HORIZON_YEARS,
  PHOSPHATE_VERDICT_TEXT,
} from "./phosphate-format"
import { PhosphateStatusIcon } from "./phosphate-soil"

/** One field in the table: its result, status and name. */
export type PhosphateFieldRow = {
  fieldResult: PhosphateBalanceFieldResult
  status: PhosphateStatus | null
  name: string
  area: number
}

/**
 * Sorts the rows of the field table; within equal values, the most urgent and largest first.
 *
 * @param rows - The fields.
 * @param key - The column to sort on.
 * @param dir - The direction.
 * @returns The sorted rows (a new array).
 */
export function sortPhosphateFieldRows(
  rows: PhosphateFieldRow[],
  key: PhosphateFieldSortKey,
  dir: "asc" | "desc",
): PhosphateFieldRow[] {
  const rank = (row: PhosphateFieldRow) =>
    row.status
      ? PHOSPHATE_VERDICT_ORDER.indexOf(row.status.verdict)
      : PHOSPHATE_VERDICT_ORDER.length
  const sign = dir === "asc" ? 1 : -1
  return [...rows].sort((a, b) => {
    let diff = 0
    if (key === "verdict") diff = rank(a) - rank(b)
    if (key === "name") diff = a.name.localeCompare(b.name, "nl")
    if (key === "area") diff = a.area - b.area
    if (key === "saldo") {
      diff =
        (a.fieldResult.balance?.long_term.balance ?? Number.NEGATIVE_INFINITY) -
        (b.fieldResult.balance?.long_term.balance ?? Number.NEGATIVE_INFINITY)
    }
    return sign * diff || rank(a) - rank(b) || b.area - a.area
  })
}

/**
 * The value of the indicator that decides the status, e.g. "PSD 29 / 19 %" or "P-AL 18". Inside the
 * zone without a deciding bound: the PSD with its threshold when usable, otherwise P-AL.
 */
function formatDecidingValue(balance: PhosphateBalanceField, status: PhosphateStatus): string {
  const psd = balance.projection?.psd
  const pAl = balance.projection?.p_al?.current
  const psdText =
    psd && psd.threshold.value !== null && balance.saturation.psd_valid
      ? `PSD ${formatNumberNl(psd.current.value)} / ${formatNumberNl(psd.threshold.value)} %`
      : null
  const pAlText = pAl !== undefined ? `P-AL ${formatNumberNl(pAl)}` : null
  if (status.binding === "p_al") return pAlText ?? "–"
  if (status.binding === "psd") return psdText ?? "–"
  return psdText ?? pAlText ?? "–"
}

/**
 * One field in the compact list (narrow screens): the whole row is a link with a large tap target;
 * verdict, name and saldo on the first line, aim and the deciding value on the second, direction
 * and time on the third.
 */
export function PhosphateFieldListItem({
  fieldResult,
  status,
  name,
  area,
  showIndicative,
}: PhosphateFieldRow & { showIndicative: boolean }) {
  const balance = fieldResult.balance
  const inside = status?.aim === "onderhouden" && !status.conflict
  const years = status ? formatYearsBand(status.years) : null
  const direction = status ? describePhosphateDirection(status) : null
  return (
    <li>
      <NavLink
        to={`./${fieldResult.b_id}`}
        className="hover:bg-muted/50 focus-visible:ring-ring/50 -mx-2 block space-y-1 rounded-md px-2 py-3 outline-none focus-visible:ring-[3px]"
      >
        <div className="flex items-start gap-2">
          {status ? (
            <PhosphateStatusIcon verdict={status.verdict} className="mt-0.5 size-5" decorative />
          ) : (
            <OctagonAlert className="mt-0.5 size-5 shrink-0 text-red-700" aria-hidden="true" />
          )}
          <div className="min-w-0 flex-1">
            <p className="font-medium">{name}</p>
            <p className="text-muted-foreground text-xs">
              {status ? PHOSPHATE_VERDICT_TEXT[status.verdict].label : "Fout"}
              {showIndicative && status?.indicative && status.verdict !== "unknown"
                ? " (indicatief)"
                : ""}
              , {formatAreaHa(area)}
            </p>
          </div>
          <div className="text-right">
            <p className="font-medium tabular-nums">
              {balance ? formatNumberNl(balance.long_term.balance) : "–"}
            </p>
            <p className="text-muted-foreground text-xs">gem. balans</p>
          </div>
        </div>
        {balance && status && status.verdict !== "unknown" ? (
          <div className="text-muted-foreground space-y-0.5 pl-7 text-sm">
            <p>
              <span className="text-foreground">{formatPhosphateAim(status)}</span>:{" "}
              <span className="whitespace-nowrap">{formatDecidingValue(balance, status)}</span>
            </p>
            <p>
              {direction?.verb}
              {direction?.meaning ? `, ${direction.meaning}` : ""}.{" "}
              {inside
                ? `In de zone: ${years ?? `> ${PHOSPHATE_HORIZON_YEARS} jaar`}.`
                : `Tot het doel: ${years ?? formatYearsClass(status.years_class)}.`}
            </p>
          </div>
        ) : !balance ? (
          <p className="text-muted-foreground pl-7 text-sm">
            De balans kon niet worden berekend. Open het perceel om opnieuw te proberen.
          </p>
        ) : null}
      </NavLink>
    </li>
  )
}

/** Arrow icon per direction (shown next to the direction text, never on its own). */
const DIRECTION_ICON = { up: ArrowUpRight, down: ArrowDownRight, stable: ArrowRight } as const

/**
 * One field in the table: verdict, name with area and crop, aim, the value of the indicator that
 * decides, the direction against the aim, how long, and the long-term average saldo.
 */
export function PhosphateFieldTableRow({
  fieldResult,
  status,
  name,
  area,
  showIndicative,
  cultivations,
}: PhosphateFieldRow & { showIndicative: boolean; cultivations: ReactNode }) {
  const balance = fieldResult.balance
  const link = (
    <NavLink
      to={`./${fieldResult.b_id}`}
      className="font-medium underline-offset-4 hover:underline"
    >
      {name}
    </NavLink>
  )
  if (!balance || !status) {
    return (
      <TableRow>
        <TableCell>
          <span className="inline-flex items-center gap-1.5 text-sm font-medium">
            <OctagonAlert className="size-4 shrink-0 text-red-700" aria-hidden="true" />
            Fout
          </span>
        </TableCell>
        <TableCell>{link}</TableCell>
        <TableCell className="text-right whitespace-nowrap tabular-nums">
          {formatAreaHa(area)}
        </TableCell>
        <TableCell colSpan={5} className="text-muted-foreground text-sm">
          De balans kon niet worden berekend.{" "}
          <NavLink
            to={`./${fieldResult.b_id}`}
            className="text-foreground underline underline-offset-4"
          >
            Opnieuw proberen
          </NavLink>
        </TableCell>
      </TableRow>
    )
  }
  const direction = describePhosphateDirection(status)
  const DirectionIcon = DIRECTION_ICON[status.direction]
  const inside = status.aim === "onderhouden" && !status.conflict
  const years = formatYearsBand(status.years)
  return (
    <TableRow>
      <TableCell>
        <span className="inline-flex items-center gap-1.5 text-sm font-medium">
          <PhosphateStatusIcon verdict={status.verdict} className="size-5" decorative />
          {PHOSPHATE_VERDICT_TEXT[status.verdict].label}
        </span>
        {showIndicative && status.indicative && status.verdict !== "unknown" ? (
          <span className="text-muted-foreground block pl-6.5 text-xs">indicatief</span>
        ) : null}
      </TableCell>
      <TableCell className="space-y-1">
        <div>{link}</div>
        {cultivations}
      </TableCell>
      <TableCell className="text-right whitespace-nowrap tabular-nums">
        {formatAreaHa(area)}
      </TableCell>
      <TableCell className="text-sm">{formatPhosphateAim(status)}</TableCell>
      <TableCell className="text-sm whitespace-nowrap tabular-nums">
        {formatDecidingValue(balance, status)}
      </TableCell>
      <TableCell className="text-sm">
        {status.verdict === "unknown" ? (
          "–"
        ) : (
          <span className="inline-flex items-start gap-1">
            <DirectionIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>
              {direction.verb}
              {direction.meaning ? (
                <span className="text-muted-foreground block text-xs">{direction.meaning}</span>
              ) : null}
            </span>
          </span>
        )}
      </TableCell>
      <TableCell className="text-sm">
        {status.verdict === "unknown"
          ? "–"
          : inside
            ? (years ?? `> ${PHOSPHATE_HORIZON_YEARS} jaar`)
            : (years ?? formatYearsClass(status.years_class))}
      </TableCell>
      <TableCell className="text-right font-medium tabular-nums">
        {formatNumberNl(balance.long_term.balance)}
      </TableCell>
    </TableRow>
  )
}
