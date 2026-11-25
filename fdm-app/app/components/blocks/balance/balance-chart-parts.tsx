/**
 * Shared parts of the balance charts (nitrogen, organic matter, phosphate): the row labels on the
 * y-axis and the tooltip of a bar.
 */

/** The two rows of a balance chart: what comes in, and what goes out. */
export type BalanceRow = "supply" | "removal"

/** Width (px) of the y-axis with the row labels. */
export const BALANCE_AXIS_WIDTH = 84

/**
 * Space (px) above and below each bar within its row, so the supply and removal bars sit close
 * together (8 px apart) at every chart height.
 */
export const BALANCE_BAR_GAP = 4

/**
 * Builds the two rows of a balance chart from the values per data key: the supply row holds the
 * supply keys, the removal row the removal keys. Both rows stack in one stack, so each bar gets the
 * full height of its row, and an empty side still keeps its labelled row.
 *
 * @param values - The value per data key.
 * @param supplyKeys - The data keys of the supply bar.
 * @param removalKeys - The data keys of the removal bar.
 * @returns The chart data: one object per row, with `name` the row.
 */
export function toBalanceRows(
  values: Record<string, string | number | undefined>,
  supplyKeys: string[],
  removalKeys: string[],
): Record<string, string | number | undefined>[] {
  const row = (name: BalanceRow, keys: string[]) =>
    Object.fromEntries([["name", name], ...keys.map((key) => [key, values[key]])])
  return [row("supply", supplyKeys), row("removal", removalKeys)]
}

/**
 * Label of a row on the y-axis: "+ Aanvoer" for the supply, "− Afvoer" (or the term of the chart)
 * for the removal, so it is clear which bar adds and which removes. A label can have several lines.
 * Use it as the `tick` of the `YAxis`.
 *
 * @param x - Position given by Recharts.
 * @param y - Position given by Recharts.
 * @param payload - The tick, with the row as value.
 * @param labels - The label lines per row, e.g. `{ supply: ["Aanvoer"], removal: ["Afvoer"] }`.
 */
export function BalanceRowTick({
  x,
  y,
  payload,
  labels,
}: {
  x?: number | string
  y?: number | string
  payload?: { value?: unknown }
  labels: Record<BalanceRow, string[]>
}) {
  const row = payload?.value === "supply" || payload?.value === "removal" ? payload.value : null
  if (!row) return null
  const lines = labels[row]
  const lineHeight = 1.2 // em
  return (
    <text
      x={Number(x) - 8}
      y={Number(y)}
      textAnchor="end"
      dominantBaseline="central"
      className="fill-foreground text-xs font-medium"
    >
      {lines.map((line, i) => (
        <tspan
          key={line}
          x={Number(x) - 8}
          dy={i === 0 ? `${(-(lines.length - 1) * lineHeight) / 2}em` : `${lineHeight}em`}
        >
          {i === 0 ? (
            <tspan className="fill-muted-foreground">{row === "supply" ? "+ " : "− "}</tspan>
          ) : null}
          {line}
        </tspan>
      ))}
    </text>
  )
}

/**
 * Tooltip of a bar in the balance charts (nitrogen, organic matter, phosphate): the term with its
 * colour, the details that identify the item (e.g. the fertilizer and the date of an application)
 * and the value with its unit. One layout for all balances, in the style of the chart tooltips of
 * the app.
 *
 * @param color - Colour of the bar, shown as a swatch next to the title.
 * @param title - The term, e.g. "Aanvoer: dierlijke mest".
 * @param details - Lines that identify the item, e.g. the fertilizer name and the date.
 * @param value - The formatted value.
 * @param unit - The unit of the value, e.g. "kg N / ha".
 */
export function BalanceChartTooltip({
  color,
  title,
  details = [],
  value,
  unit,
}: {
  color?: string
  title: string
  details?: string[]
  value: string
  unit: string
}) {
  return (
    <div className="border-border/50 bg-background text-foreground grid max-w-72 min-w-40 gap-1 rounded-lg border px-3 py-2 text-xs shadow-xl">
      <div className="flex items-center gap-2 font-medium">
        <span
          className="size-2.5 shrink-0 rounded-[2px]"
          style={{ backgroundColor: color }}
          aria-hidden="true"
        />
        <span>{title}</span>
      </div>
      {details.length > 0 ? (
        <div className="text-muted-foreground pl-4.5">
          {details.map((detail, i) => (
            <p key={`${i}:${detail}`}>{detail}</p>
          ))}
        </div>
      ) : null}
      <p className="pl-4.5 tabular-nums">
        <span className="text-sm font-semibold">{value}</span>{" "}
        <span className="text-muted-foreground">{unit}</span>
      </p>
    </div>
  )
}
