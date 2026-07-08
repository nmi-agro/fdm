import { Progress } from "~/components/ui/progress"

export type AdviceProgressStatus = "under" | "on-target" | "over"

const ADVICE_UNDER_THRESHOLD = 90
const ADVICE_OVER_THRESHOLD = 110

const ADVICE_STATUS_INDICATOR_CLASSES: Record<AdviceProgressStatus, string> = {
  under: "bg-orange-500",
  "on-target": "bg-green-500",
  over: "bg-red-500",
}

/**
 * Computes the fill percentage and status for a nutrient-advice usage bar.
 *
 * Orange when supplied < 90% of the advice (risk of yield loss), green when within
 * 90–110% of the advice, red when > 110% of the advice (risk of environmental loss).
 * When there is no requirement (target <= 0), any applied amount is treated as an
 * unnecessary excess (red); no application against no requirement reads as on-target.
 *
 * Some nutrients (e.g. EOC / effective organic carbon) are never harmful in excess, so
 * `excessExempt` caps the status at "on-target" instead of ever reporting "over".
 */
export function computeAdviceProgress(current: number, target: number, excessExempt = false) {
  if (target <= 0) {
    const status: AdviceProgressStatus = current > 0 && !excessExempt ? "over" : "on-target"
    return { percentage: current > 0 ? 100 : 0, status }
  }

  const rawPercentage = (current / target) * 100
  const status: AdviceProgressStatus =
    rawPercentage < ADVICE_UNDER_THRESHOLD
      ? "under"
      : rawPercentage > ADVICE_OVER_THRESHOLD && !excessExempt
        ? "over"
        : "on-target"

  return { percentage: Math.min(rawPercentage, 100), status }
}

/**
 * Shared applied-vs-advice progress bar for bemestingsadvies/nutrient advice, used across the
 * fertilizer applications dashboard and field dashboard so the under/on-target/over color logic
 * stays consistent everywhere.
 */
export function AdviceProgressBar({
  current,
  target,
  excessExempt,
  className,
}: {
  current: number
  target: number
  excessExempt?: boolean
  className?: string
}) {
  const { percentage, status } = computeAdviceProgress(current, target, excessExempt)
  return (
    <Progress
      value={percentage}
      indicatorClassName={ADVICE_STATUS_INDICATOR_CLASSES[status]}
      className={className ?? "h-2"}
    />
  )
}
