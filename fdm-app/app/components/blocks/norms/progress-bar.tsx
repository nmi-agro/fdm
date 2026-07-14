import { Progress } from "~/components/ui/progress"

/**
 * Computes the fill percentage and over-limit status for a gebruiksnorm usage bar.
 *
 * When the limit is 0 (or missing) but there is still usage, the bar must read as fully
 * over the limit (100%, colored red) rather than empty/gray — any usage against a
 * zero-limit norm is by definition a full overrun.
 */
export function computeNormProgress(used: number, limit: number) {
  const isOverLimit = limit > 0 ? used > limit : used > 0
  const rawPercentage = limit > 0 ? (used / limit) * 100 : isOverLimit ? 100 : 0
  return {
    percentage: Math.min(rawPercentage, 100),
    isOverLimit,
  }
}

/**
 * Shared usage-vs-limit progress bar for gebruiksnormen/gebruiksruimte, used across the farm
 * norms overview, field norms page, fertilizer applications dashboard, and field dashboard so
 * the over-limit color logic (including the zero-limit-with-usage edge case) stays consistent
 * everywhere: green when used <= limit, red when used > limit.
 */
export function NormProgressBar({
  used,
  limit,
  className,
}: {
  used: number
  limit: number
  className?: string
}) {
  const { percentage, isOverLimit } = computeNormProgress(used, limit)
  return (
    <Progress
      value={percentage}
      indicatorClassName={isOverLimit ? "bg-red-500" : "bg-green-500"}
      className={className ?? "h-2"}
    />
  )
}
