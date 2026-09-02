import { getScoreColor, getScoreVerdict } from "~/lib/indicators"
import { AtlasTooltipContent } from "../atlas/atlas-tooltip"

export type ScoreTooltipBodyChildScore = {
  /** Used as the React key; falls back to label if omitted. */
  id?: string
  label: string
  score: number | null
}

export type ScoreTooltipBodyProps = {
  /** The primary score to display, or null if no data is available. */
  score: number | null
  /** Human-readable label for the score. */
  label?: string
  /** Child indicator scores shown below the primary score row. */
  childScores?: ScoreTooltipBodyChildScore[]
  /**
   * "row"   – label and score badge rendered side-by-side inside AtlasTooltipContent (default).
   *           Falls back to an inline paragraph when no label is provided.
   *           Shows "Geen data" when score is null.
   * "stack" – label rendered as a separate paragraph above the badge.
   *           Nothing is rendered when score is null.
   */
  layout?: "row" | "stack"
}

/**
 * Shared body for map hover / popup tooltips that display a score, an optional label, and optional
 * child scores. Used by both the farm-level IndicatorsMap and the field-level FieldMap.
 */
export function ScoreTooltipBody({
  score,
  label,
  childScores,
  layout = "row",
}: ScoreTooltipBodyProps) {
  return (
    <>
      {layout === "row" ? (
        label ? (
          <AtlasTooltipContent>
            <span className="text-muted-foreground truncate">{label}</span>
            {score != null ? (
              <span
                className="inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white"
                style={{ backgroundColor: getScoreColor(score) }}
              >
                {score} – {getScoreVerdict(score)}
              </span>
            ) : (
              <span className="text-muted-foreground italic">Geen data</span>
            )}
          </AtlasTooltipContent>
        ) : (
          <p className="text-muted-foreground mt-0.5">
            {score != null ? (
              <>
                Score:{" "}
                <span className="font-semibold" style={{ color: getScoreColor(score) }}>
                  {score}
                </span>
                {" – "}
                {getScoreVerdict(score)}
              </>
            ) : (
              "Geen data"
            )}
          </p>
        )
      ) : (
        <>
          {label && <p className="text-muted-foreground text-[10px]">{label}</p>}
          {score !== null && (
            <span
              className="mt-0.5 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white"
              style={{ backgroundColor: getScoreColor(score) }}
            >
              {score} – {getScoreVerdict(score)}
            </span>
          )}
        </>
      )}
      {childScores && childScores.length > 0 && (
        <AtlasTooltipContent className="flex-wrap">
          {childScores.map(({ id, label: childLabel, score: childScore }) => (
            <div key={id ?? childLabel} className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground truncate text-[10px]">{childLabel}</span>
              {childScore != null ? (
                <span
                  className="shrink-0 text-[10px] font-semibold tabular-nums"
                  style={{ color: getScoreColor(childScore) }}
                >
                  {childScore}
                </span>
              ) : (
                <span className="text-muted-foreground shrink-0 text-[10px] italic">–</span>
              )}
            </div>
          ))}
        </AtlasTooltipContent>
      )}
    </>
  )
}
