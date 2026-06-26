/**
 * Radar (spider) chart showing BLN3 indicator scores for a single field.
 *
 * Shows all 28 indicators at once. Tick labels are coloured by category so
 * the user can spot clusters at a glance. Two overlaid radars:
 * - Index (field state without measures) — dashed, semi-transparent
 * - Score (field state + measures)       — solid fill
 */

import type { Bln3IndicatorResult } from "@nmi-agro/fdm-calculator"
import { useMemo } from "react"
import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts"
import {
  type Ecosysteemdienst,
  INDICATORS,
  type IndicatorInfo,
  scoreToDisplay,
} from "~/lib/indicators"

// Hex colours matching ecosystem service chip colours
const ECOSYSTEEMDIENST_COLORS: Record<Ecosysteemdienst, string> = {
  Productie: "#f97316", // orange-500
  Klimaat: "#78716c", // stone-500
  Water: "#3b82f6", // blue-500
  Nutriëntenkringloop: "#8b5cf6", // violet-500
}

// Pre-compute indicator id → ecosystem service colour for fast lookup
const ID_TO_COLOR = new Map<string, string>(
  INDICATORS.map((i) => [i.id, ECOSYSTEEMDIENST_COLORS[i.ecosysteemdienst]]),
)

type IndicatorRadarChartProps = {
  /** All 28 indicator results from the BLN3 API */
  indicators: Bln3IndicatorResult[]
  /** Indicator metadata — pass all INDICATORS (not filtered) */
  indicatorInfos: IndicatorInfo[]
}

type RadarDataPoint = {
  id: string
  name: string
  /** Short label for the axis — indicator ID */
  label: string
  index: number
  score: number
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: RadarDataPoint }>
}) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-background/95 backdrop-blur-sm border rounded-lg px-3 py-2 shadow-md text-xs">
      <p className="font-semibold mb-1">{d.name}</p>
      <p className="text-muted-foreground">
        Perceel <span className="font-medium text-foreground">{d.index}</span>
      </p>
      <p className="text-muted-foreground">
        Met maatregelen <span className="font-medium text-foreground">{d.score}</span>
      </p>
    </div>
  )
}

// Custom tick renderer that colours each label by its indicator's category
function CategoryTick(props: {
  x?: string | number
  y?: string | number
  cx?: string | number
  cy?: string | number
  payload?: { value: string }
  [key: string]: unknown
}) {
  const x = Number(props.x ?? 0)
  const y = Number(props.y ?? 0)
  const cx = Number(props.cx ?? 0)
  const id = props.payload?.value ?? ""
  const fill = ID_TO_COLOR.get(id) ?? "hsl(var(--muted-foreground))"
  const dx = x - cx
  const textAnchor = Math.abs(dx) < 6 ? "middle" : dx > 0 ? "start" : "end"

  return (
    <text
      x={x}
      y={y}
      textAnchor={textAnchor}
      dominantBaseline="central"
      fontSize={9}
      fill={fill}
      fontWeight="600"
    >
      {id}
    </text>
  )
}

export function IndicatorRadarChart({ indicators, indicatorInfos }: IndicatorRadarChartProps) {
  const data = useMemo<RadarDataPoint[]>(() => {
    return indicatorInfos.flatMap((info) => {
      const result = indicators.find((r) => r.indicator_id === info.id)
      if (!result) return []
      return [
        {
          id: info.id,
          name: info.name,
          label: info.id,
          index: scoreToDisplay(result.index),
          score: scoreToDisplay(result.score),
        },
      ]
    })
  }, [indicators, indicatorInfos])

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-52 text-sm text-muted-foreground">
        Geen indicatoren beschikbaar.
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <RadarChart data={data} margin={{ top: 20, right: 50, bottom: 20, left: 50 }}>
        <PolarGrid stroke="hsl(var(--border))" />
        <PolarAngleAxis dataKey="label" tick={(tickProps) => <CategoryTick {...tickProps} />} />
        <Tooltip content={<CustomTooltip />} />
        {/* Index — without measures */}
        <Radar
          name="Perceel"
          dataKey="index"
          stroke="#94a3b8"
          fill="#94a3b8"
          fillOpacity={0.1}
          strokeDasharray="4 3"
          strokeWidth={1.5}
        />
        {/* Score — with measures */}
        <Radar
          name="Met maatregelen"
          dataKey="score"
          stroke="#22c55e"
          fill="#22c55e"
          fillOpacity={0.25}
          strokeWidth={2}
        />
      </RadarChart>
    </ResponsiveContainer>
  )
}
