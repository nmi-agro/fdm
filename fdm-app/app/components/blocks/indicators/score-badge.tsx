import { cn } from "~/lib/utils"
import { getScoreTier, getScoreVerdict } from "~/lib/indicators"

/**
 * Displays a colour-coded Dutch verdict badge for a 0–100 indicator score.
 * Green ≥70 · Yellow 40–69 · Red <40.
 */
export function ScoreBadge({
    score,
    className,
}: {
    score: number
    className?: string
}) {
    const tier = getScoreTier(score)
    const verdict = getScoreVerdict(score)

    return (
        <span
            className={cn(
                "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
                tier === "green" &&
                    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
                tier === "yellow" &&
                    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
                tier === "red" &&
                    "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
                className,
            )}
        >
            {verdict}
        </span>
    )
}
