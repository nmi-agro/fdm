/**
 * Collapsible block surfacing indicators that need attention (red or yellow
 * score) on a field. When all indicators are green, shows a compliment.
 * Always includes a link to the full indicators page.
 */
import type { Bln3IndicatorResult } from "@nmi-agro/fdm-calculator"
import { BarChart2, CheckCircle2, ChevronDown, ChevronUp, Plus } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router"
import { cn } from "@/app/lib/utils"
import { ScoreBadge } from "~/components/blocks/indicators/score-badge"
import { Button } from "~/components/ui/button"
import {
  getIndicatorInfo,
  getScoreColor,
  getScoreTier,
  type IndicatorInfo,
  scoreToDisplay,
} from "~/lib/indicators"

type AttentionItem = {
  result: Bln3IndicatorResult
  info: IndicatorInfo
  display: number
}

const CATEGORY_COLORS: Record<string, string> = {
  Productie: "bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400",
  Klimaat: "bg-stone-100 text-stone-700 dark:bg-stone-950/30 dark:text-stone-400",
  Water: "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400",
  Nutriëntenkringloop: "bg-violet-100 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400",
}

type IndicatorAttentionProps = {
  indicators: Bln3IndicatorResult[]
  onAddMeasure: () => void
  indicatorsHref: string
  canAddMeasure?: boolean
}

export function IndicatorAttention({
  indicators,
  onAddMeasure,
  indicatorsHref,
  canAddMeasure = true,
}: IndicatorAttentionProps) {
  const [expanded, setExpanded] = useState(false)

  const needsAttention: AttentionItem[] = indicators
    .filter((r) => getScoreTier(scoreToDisplay(r.score)) !== "green")
    .sort((a, b) => a.score - b.score)
    .map((r) => ({
      result: r,
      info: getIndicatorInfo(r.indicator_id),
      display: scoreToDisplay(r.score),
    }))
    .filter((x): x is AttentionItem => x.info !== undefined)

  // All green — show a compliment with a link to the indicators page
  if (needsAttention.length === 0) {
    return (
      <div className="flex items-center justify-between gap-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 dark:border-green-900/40 dark:bg-green-950/20">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
          <div>
            <p className="text-sm font-medium text-green-900 dark:text-green-200">
              Alle indicatoren scoren voldoende
            </p>
            <p className="mt-0.5 text-xs text-green-700 dark:text-green-400">
              Goed bezig! De bodemkwaliteit van dit perceel ziet er goed uit.
            </p>
          </div>
        </div>
        <Link
          to={indicatorsHref}
          className="inline-flex shrink-0 items-center gap-1.5 text-sm text-green-700 transition-colors hover:text-green-900 dark:text-green-400 dark:hover:text-green-200"
        >
          <BarChart2 className="h-4 w-4" />
          <span className="hidden sm:inline">Alle indicatoren</span>
        </Link>
      </div>
    )
  }

  const redCount = needsAttention.filter((x) => getScoreTier(x.display) === "red").length

  return (
    <div className="overflow-hidden rounded-lg border border-orange-200 dark:border-orange-900/40">
      <button
        type="button"
        className="flex w-full items-center justify-between bg-orange-50 px-4 py-3 text-left transition-colors hover:bg-orange-100 dark:bg-orange-950/20 dark:hover:bg-orange-950/30"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
      >
        <div>
          <p className="text-sm font-medium text-orange-900 dark:text-orange-200">
            {needsAttention.length}{" "}
            {needsAttention.length === 1 ? "indicator vraagt" : "indicatoren vragen"} aandacht
          </p>
          <p className="mt-0.5 text-xs text-orange-700 dark:text-orange-400">
            {redCount > 0
              ? `${redCount} met onvoldoende score — overweeg een maatregel`
              : "Matige scores — overweeg een maatregel"}
          </p>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-orange-600" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-orange-600" />
        )}
      </button>

      {expanded && (
        <div className="bg-background space-y-2.5 px-4 py-3">
          {needsAttention.map(({ result, info, display }) => (
            <div key={result.indicator_id} className="flex items-center gap-3">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{
                  backgroundColor: getScoreColor(display),
                }}
              >
                {display}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{info.name}</p>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${CATEGORY_COLORS[info.ecosysteemdienst] ?? "bg-muted text-muted-foreground"}`}
                >
                  {info.ecosysteemdienst}
                </span>
              </div>
              <ScoreBadge score={display} className="shrink-0" />
            </div>
          ))}

          <div className="flex items-center justify-between gap-2 border-t pt-2">
            <Button
              size="sm"
              variant="outline"
              onClick={onAddMeasure}
              className={cn(!canAddMeasure && "invisible")}
              disabled={!canAddMeasure}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Maatregel toevoegen
            </Button>
            <Link
              to={indicatorsHref}
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
            >
              <BarChart2 className="h-4 w-4" />
              <span className="hidden sm:inline">Alle indicatoren</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
