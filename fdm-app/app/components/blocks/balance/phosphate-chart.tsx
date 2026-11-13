import type {
  PhosphateBalance,
  PhosphateBalanceField,
  PhosphateFieldInput,
} from "@nmi-agro/fdm-calculator"
import { format } from "date-fns"
import { nl } from "date-fns/locale/nl"
import { type JSX, useId, useState } from "react"
import { Bar, BarChart, XAxis, YAxis, ZIndexLayer } from "recharts"
import { Card, CardContent, CardHeader } from "~/components/ui/card"
import { ChartContainer, ChartLegend, ChartTooltip } from "~/components/ui/chart"
import { formatNumberNl, PHOSPHATE_UNIT } from "./phosphate-format"

/** Colors and labels of the terms, the same as in the nitrogen balance chart. */
const TERMS = {
  deposition: { label: "Depositie", color: "var(--color-yellow-400)" },
  mineralization: { label: "Mineralisatie", color: "var(--color-lime-400)" },
  mineral: { label: "Kunstmest", color: "var(--color-sky-600)" },
  manure: { label: "Dierlijke mest", color: "var(--color-yellow-600)" },
  compost: { label: "Compost", color: "var(--color-green-600)" },
  other: { label: "Overige meststoffen", color: "var(--color-gray-600)" },
  harvests: { label: "Oogst", color: "var(--color-teal-600)" },
  residues: { label: "Gewasresten", color: "var(--color-emerald-600)" },
} as const

type Term = keyof typeof TERMS
const FERTILIZER_TYPES = ["mineral", "manure", "compost", "other"] as const

/** One block in a stacked bar: a term, or one application / harvest of a term. */
type Segment = { key: string; term: Term; value: number; detail: string[] }

/**
 * Builds the blocks of the supply bar (deposition, mineralisation, fertilizers per type) and the
 * removal bar (harvests, crop residues). On field level each application and harvest is its own
 * block; on farm level the area-weighted totals per term are used.
 */
function buildSegments(props: PhosphateBalanceChartProps): {
  supply: Segment[]
  removal: Segment[]
} {
  const supply: Segment[] = []
  const removal: Segment[] = []
  const add = (bar: Segment[], segment: Segment) => {
    if (Math.abs(segment.value) > 0) bar.push({ ...segment, value: Math.abs(segment.value) })
  }

  if (props.type === "farm") {
    const { terms } = props.balance
    add(supply, {
      key: "deposition",
      term: "deposition",
      value: terms.supply.deposition,
      detail: [],
    })
    add(supply, {
      key: "mineralization",
      term: "mineralization",
      value: terms.supply.mineralization,
      detail: [],
    })
    for (const type of FERTILIZER_TYPES) {
      add(supply, { key: type, term: type, value: terms.supply[type], detail: [] })
    }
    add(removal, { key: "harvests", term: "harvests", value: terms.removal.harvests, detail: [] })
    add(removal, { key: "residues", term: "residues", value: terms.removal.residues, detail: [] })
    return { supply, removal }
  }

  const { balance, fieldInput } = props
  add(supply, {
    key: "deposition",
    term: "deposition",
    value: balance.supply.deposition.total,
    detail: [],
  })
  add(supply, {
    key: "mineralization",
    term: "mineralization",
    value: balance.supply.mineralization.total,
    detail: [balance.supply.mineralization.track === "peat" ? "veen" : "organische stof"],
  })
  for (const type of FERTILIZER_TYPES) {
    for (const item of balance.supply.fertilizers[type].applications) {
      const application = fieldInput.fertilizerApplications.find((a) => a.p_app_id === item.id)
      add(supply, {
        key: `${type}_${item.id}`,
        term: type,
        value: item.value,
        detail: application
          ? [
              application.p_name_nl ?? "Naam onbekend",
              format(application.p_app_date, "PP", { locale: nl }),
            ]
          : ["onbekend"],
      })
    }
  }
  for (const item of balance.removal.harvests.harvests) {
    const harvest = fieldInput.harvests.find((h) => h.b_id_harvesting === item.id)
    const cultivation = harvest
      ? fieldInput.cultivations.find((c) => c.b_lu === harvest.b_lu)
      : undefined
    add(removal, {
      key: `harvests_${item.id}`,
      term: "harvests",
      value: item.value,
      detail: [
        cultivation?.b_lu_name ?? "Gewas onbekend",
        harvest?.b_lu_harvest_date
          ? format(harvest.b_lu_harvest_date, "PP", { locale: nl })
          : "Datum onbekend",
      ],
    })
  }
  for (const item of balance.removal.residues.cultivations) {
    const cultivation = fieldInput.cultivations.find((c) => c.b_lu === item.id)
    add(removal, {
      key: `residues_${item.id}`,
      term: "residues",
      value: item.value,
      detail: [cultivation?.b_lu_name ?? "Gewas onbekend"],
    })
  }
  return { supply, removal }
}

type PhosphateBalanceChartProps =
  | { type: "farm"; balance: PhosphateBalance }
  | { type: "field"; balance: PhosphateBalanceField; fieldInput: PhosphateFieldInput }

/**
 * Stacked bar chart of the phosphate balance (kg P₂O₅ / ha), like the nitrogen balance chart:
 * the supply bar shows deposition, mineralisation and the fertilizers per type (on field level per
 * application), the removal bar shows the harvests and the removed crop residues. Leaching is not
 * part of the balance and therefore not shown.
 */
export function PhosphateBalanceChart(props: PhosphateBalanceChartProps): JSX.Element {
  const [focus, setFocus] = useState<string | undefined>()
  const svgId = useId()
  const { supply, removal } = buildSegments(props)
  const segments = new Map([...supply, ...removal].map((s) => [s.key, s]))

  const chartData: Record<string, string | number> = { name: "Balans" }
  for (const segment of segments.values()) chartData[segment.key] = segment.value
  // An empty side (e.g. no supply) still gets its own bar of 0, so the chart always shows supply
  // and removal as two bars and the remaining bar keeps its size
  if (supply.length === 0) chartData.supply_empty = 0
  if (removal.length === 0) chartData.removal_empty = 0

  const presentTerms = new Set([...segments.values()].map((s) => s.term))
  const legend = (Object.keys(TERMS) as Term[]).filter((term) => presentTerms.has(term))
  const chartConfig = Object.fromEntries(
    [...segments.values()].map((s) => [
      s.key,
      { label: TERMS[s.term].label, color: TERMS[s.term].color },
    ]),
  )

  const radius = 5
  const renderBar = (stackId: string, bar: Segment[]) =>
    bar.map((segment, i) => {
      let barRadius: number | [number, number, number, number] = 0
      if (bar.length === 1) barRadius = radius
      else if (i === 0) barRadius = [radius, 0, 0, radius]
      else if (i === bar.length - 1) barRadius = [0, radius, radius, 0]
      return (
        <Bar
          key={segment.key}
          id={`${svgId}_${segment.key}`}
          dataKey={segment.key}
          stackId={stackId}
          radius={barRadius}
          fill={TERMS[segment.term].color}
          onMouseEnter={() => setFocus(segment.key)}
          onMouseLeave={() =>
            setFocus((current) => (current === segment.key ? undefined : current))
          }
        />
      )
    })

  return (
    <ChartContainer
      config={chartConfig}
      className="aspect-auto h-44 w-full"
      onMouseLeave={() => setFocus(undefined)}
    >
      <BarChart accessibilityLayer data={[chartData]} layout="vertical" margin={{ left: -20 }}>
        <XAxis type="number" />
        <YAxis
          dataKey="name"
          type="category"
          tickLine={false}
          tickMargin={10}
          axisLine={false}
          tickFormatter={() => ""}
        />
        <ChartTooltip
          shared={false}
          content={({ payload }) => {
            const item = payload?.find((p) => p && p.type !== "none")
            const segment = item?.name ? segments.get(String(item.name)) : undefined
            if (!segment) return null
            const isSupply = supply.includes(segment)
            return (
              <Card>
                <CardHeader className="p-4 pb-0">
                  <div>
                    <div
                      className="me-2 inline-block h-2 w-2 rounded-[2px]"
                      style={{ backgroundColor: TERMS[segment.term].color }}
                    />
                    {isSupply ? "Aanvoer" : "Afvoer"}: {TERMS[segment.term].label.toLowerCase()}
                  </div>
                  {segment.detail.map((detail) => (
                    <div key={detail} className="ms-4">
                      {detail}
                    </div>
                  ))}
                </CardHeader>
                <CardContent className="p-4 font-bold">
                  {formatNumberNl(segment.value, segment.value < 10 ? 1 : 0)} {PHOSPHATE_UNIT}
                </CardContent>
              </Card>
            )
          }}
        />
        <ChartLegend
          content={
            <div className="flex flex-wrap items-center justify-center gap-4">
              {legend.map((term) => (
                <div key={term} className="flex items-center gap-1.5">
                  <div
                    className="h-2 w-2 shrink-0 rounded-[2px]"
                    style={{ backgroundColor: TERMS[term].color }}
                  />
                  {TERMS[term].label}
                </div>
              ))}
            </div>
          }
        />
        {supply.length === 0 ? <Bar dataKey="supply_empty" stackId="supply" fill="none" /> : null}
        {renderBar("supply", supply)}
        {removal.length === 0 ? (
          <Bar dataKey="removal_empty" stackId="removal" fill="none" />
        ) : null}
        {renderBar("removal", removal)}
        <ZIndexLayer zIndex={2000}>
          {focus && (
            <use
              href={`#${svgId}_${focus}`}
              fill="none"
              stroke="var(--foreground)"
              strokeWidth={5}
              style={{ pointerEvents: "none" }}
            />
          )}
        </ZIndexLayer>
      </BarChart>
    </ChartContainer>
  )
}
