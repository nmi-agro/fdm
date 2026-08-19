/**
 * Expandable indicator card for the field-level indicator detail page.
 *
 * Collapsed (default): shows indicator name, category badge, status/target
 * values, a stacked progress bar (field state + measures contribution), and
 * the verdict badge.
 *
 * Expanded (on click): reveals the full indicator description, a list of
 * active measures on this field, and a link to the Maatregelen page.
 */

import type { Bln3IndicatorResult } from "@nmi-agro/fdm-calculator"
import { ChevronDown, ChevronUp, ExternalLink, Sparkles } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router"
import {
  type Ecosysteemdienst,
  type FieldMeasure,
  getScoreColor,
  getScoreTier,
  type IndicatorInfo,
  scoreToDisplay,
} from "~/lib/indicators"
import { cn } from "~/lib/utils"
import { ScoreBadge } from "./score-badge"

/** A measure recommended to improve a specific indicator on this field. */
export type RecommendedMeasure = {
  m_id: string
  m_name: string
  measure_impact: number
}

type IndicatorCardProps = {
  info: IndicatorInfo
  result: Bln3IndicatorResult
  /** All measures active on this field */
  fieldMeasures: FieldMeasure[]
  /** Link to the Maatregelen page for this field */
  measuresHref: string
  /** When true, display index instead of score */
  showIndex: boolean
  /** Start expanded — used when deep-linked via ?indicator=<id> */
  defaultExpanded?: boolean
  /**
   * Top recommended measures for this indicator (already filtered by
   * applicability and active-measure exclusion). `null` means the advice
   * fetch failed — the section is then hidden entirely rather than showing
   * a false "no measures found" empty state.
   */
  recommendedMeasures?: RecommendedMeasure[] | null
}

const CATEGORY_COLORS: Record<Ecosysteemdienst, string> = {
  Productie: "bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400",
  Klimaat: "bg-stone-100 text-stone-700 dark:bg-stone-950/30 dark:text-stone-400",
  Water: "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400",
  Nutriëntenkringloop: "bg-violet-100 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400",
}

function StackedScoreBar({
  indexValue,
  impactValue,
  indexColor,
}: {
  indexValue: number
  impactValue: number
  indexColor: string
}) {
  const indexWidth = Math.max(0, Math.min(indexValue, 100))
  const impactWidth = Math.max(0, Math.min(impactValue, 100 - indexWidth))
  const hasImpact = impactWidth > 0
  return (
    <div className="bg-muted relative h-2 w-full overflow-hidden rounded-full">
      <div
        className={cn(
          "absolute top-0 left-0 h-full transition-all duration-500",
          hasImpact ? "rounded-l-full" : "rounded-full",
        )}
        style={{
          width: `${indexWidth}%`,
          backgroundColor: indexColor,
        }}
      />
      {hasImpact && (
        <>
          {/* 2px white gap between index and impact */}
          <div
            className="bg-background absolute top-0 h-full"
            style={{ left: `${indexWidth}%`, width: "2px" }}
          />
          <div
            className="absolute top-0 h-full rounded-r-full bg-teal-400 transition-all duration-500 dark:bg-teal-400"
            style={{
              left: `calc(${indexWidth}% + 2px)`,
              width: `${impactWidth}%`,
            }}
          />
        </>
      )}
    </div>
  )
}

function formatNumber(value: unknown): string {
  if (typeof value === "string" && value.trim() === "") {
    return "-"
  }
  if (typeof value !== "number" && typeof value !== "string") {
    return "-"
  }
  const num = Number(value)
  if (Number.isFinite(num)) {
    return num.toFixed(2)
  }
  return "-"
}

export function IndicatorCard({
  info,
  result,
  fieldMeasures,
  measuresHref,
  showIndex,
  defaultExpanded = false,
  recommendedMeasures = [],
}: IndicatorCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  const indexDisplay = scoreToDisplay(result.index)
  const scoreDisplay = scoreToDisplay(result.score)
  const activeDisplay = showIndex ? indexDisplay : scoreDisplay
  const color = getScoreColor(activeDisplay)
  const tier = getScoreTier(activeDisplay)
  const indexColor = getScoreColor(indexDisplay)

  const impactDisplay = scoreToDisplay(result.impact)
  const hasImpact = impactDisplay > 0

  return (
    <div
      id={`indicator-${info.id}`}
      className={cn(
        "overflow-hidden rounded-lg border transition-shadow",
        tier === "red" && "border-red-200 dark:border-red-900/40",
        tier === "yellow" && "border-yellow-200 dark:border-yellow-900/40",
        tier === "green" && "border-green-200 dark:border-green-900/40",
      )}
    >
      {/* Card header — always visible, clickable to expand */}
      <button
        type="button"
        className="hover:bg-muted/40 w-full px-4 py-3 text-left transition-colors"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
      >
        <div className="flex items-start gap-3">
          {/* Score circle + impact pill */}
          <div className="flex shrink-0 flex-col items-center gap-1">
            <div
              className="flex h-11 w-11 flex-col items-center justify-center rounded-full text-sm leading-tight font-bold text-white"
              style={{ backgroundColor: color }}
            >
              <span>{activeDisplay}</span>
            </div>
            {!showIndex && hasImpact && (
              <span className="inline-flex items-center rounded-full bg-teal-100 px-1.5 py-0.5 text-xs leading-none font-semibold text-teal-700 dark:bg-teal-900/30 dark:text-teal-400">
                +{impactDisplay}
              </span>
            )}
          </div>

          {/* Main content */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">{info.name}</span>
              <span className="text-muted-foreground font-mono text-xs">{info.id}</span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-medium",
                  CATEGORY_COLORS[info.ecosysteemdienst],
                )}
              >
                {info.ecosysteemdienst}
              </span>
            </div>

            {/* Status & target */}
            <p className="text-muted-foreground mt-0.5 text-xs">
              Status{" "}
              <span className="text-foreground font-medium">{formatNumber(result.status)}</span>
              {info.unit && <span className="text-muted-foreground"> {info.unit}</span>}
              {"  "}· Doel{" "}
              <span className="text-foreground font-medium">{formatNumber(result.target)}</span>
              {info.unit && <span className="text-muted-foreground"> {info.unit}</span>}
            </p>

            {/* Stacked score bar */}
            <div className="mt-2 space-y-1">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <StackedScoreBar
                    indexValue={indexDisplay}
                    impactValue={showIndex ? 0 : impactDisplay}
                    indexColor={indexColor}
                  />
                </div>
                <span className="w-6 text-right text-xs font-medium tabular-nums">
                  {activeDisplay}
                </span>
              </div>
              {/* Legend: only shown when measures are visible and there is impact */}
              {!showIndex && hasImpact && (
                <div className="text-muted-foreground flex gap-3 text-xs">
                  <span className="flex items-center gap-1">
                    <span
                      className="inline-block h-1.5 w-2 rounded-sm"
                      style={{
                        backgroundColor: indexColor,
                      }}
                    />
                    Perceel: {indexDisplay}
                  </span>
                  <span className="flex items-center gap-1 text-teal-600 dark:text-teal-400">
                    <span className="inline-block h-1.5 w-2 rounded-sm bg-teal-400 dark:bg-teal-400" />
                    Maatregelen: +{impactDisplay}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Right side: verdict + chevron */}
          <div className="flex w-32 shrink-0 flex-col items-end gap-1.5">
            <ScoreBadge score={activeDisplay} />
            {expanded ? (
              <ChevronUp className="text-muted-foreground mt-1 h-4 w-4" />
            ) : (
              <ChevronDown className="text-muted-foreground mt-1 h-4 w-4" />
            )}
          </div>
        </div>
      </button>

      {/* Expanded detail panel */}
      {expanded && (
        <div className="bg-muted/20 space-y-4 border-t px-4 py-3 text-sm">
          {/* Description */}
          {info.description && (
            <div>
              <p className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
                Beschrijving
              </p>
              <p className="text-foreground text-sm">{info.description}</p>
            </div>
          )}

          {/* Active measures with impact on this indicator */}
          {hasImpact && fieldMeasures.length > 0 && (
            <div>
              <p className="text-muted-foreground mb-1.5 text-xs font-medium tracking-wide uppercase">
                Maatregelen met bijdrage aan deze indicator
              </p>
              <ul className="space-y-1">
                {fieldMeasures.map((measure) => (
                  <li key={measure.b_id_measure} className="flex items-start gap-2 text-xs">
                    <span className="text-muted-foreground shrink-0 font-mono">
                      {measure.m_id.replace("bln_", "")}
                    </span>
                    <span className="text-foreground">{measure.m_name}</span>
                    {measure.m_end === null && (
                      <span className="text-muted-foreground ml-auto shrink-0 text-xs">
                        doorlopend
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommended measures for this indicator (non-green only).
              Hidden entirely when advice is unavailable (null) — a failed
              fetch must never render as a false "no measures found" state. */}
          {tier !== "green" && recommendedMeasures !== null && (
            <div>
              <p className="text-muted-foreground mb-1.5 text-xs font-medium tracking-wide uppercase">
                Aanbevolen maatregelen
              </p>
              {recommendedMeasures.length === 0 ? (
                <p className="text-muted-foreground text-xs italic">
                  Geen maatregelen met noemenswaardig effect gevonden voor deze indicator.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {recommendedMeasures.map((measure) => {
                    // True scale: NMI confirms measure_impact is always 0-1,
                    // so the bar is impact × 100% — comparable across cards.
                    const barWidth = Math.max(4, Math.min(100, measure.measure_impact * 100))
                    return (
                      <li
                        key={measure.m_id}
                        className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50/50 px-2 py-1.5 text-xs dark:border-emerald-900/40 dark:bg-emerald-950/10"
                      >
                        <Sparkles className="h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <div className="min-w-0 flex-1">
                          <span className="text-muted-foreground mr-1.5 font-mono">
                            {measure.m_id.replace("bln_", "")}
                          </span>
                          <span className="text-foreground font-medium">{measure.m_name}</span>
                          <div className="bg-muted mt-1 h-1 w-full max-w-24 overflow-hidden rounded-full">
                            <div
                              className="h-full rounded-full bg-emerald-500"
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                        </div>
                        <Link
                          to={`${measuresHref}?openMeasure=${encodeURIComponent(measure.m_id)}&indicator=${encodeURIComponent(info.id)}`}
                          aria-label={`${measure.m_name} toevoegen`}
                          className="shrink-0 font-semibold text-emerald-700 transition-colors hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-200"
                        >
                          + Toevoegen
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}

          {/* Link to measures page */}
          <Link
            to={measuresHref}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            Maatregelen beheren
          </Link>
        </div>
      )}
    </div>
  )
}
