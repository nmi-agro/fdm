import type { BcsIndicatorKey } from "~/lib/bcs"
import {
    BCS_COLOR_CLASSES,
    indicatorScoreColor,
} from "~/components/blocks/soil-visual/bcs-color-utils"
import { Button } from "~/components/ui/button"
import { cn } from "~/lib/utils"

interface ScoreButtonProps {
    indicator: BcsIndicatorKey
    direction: "positive" | "negative"
    value: 0 | 1 | 2 | null
    onChange: (score: 0 | 1 | 2) => void
    disabled?: boolean
}

const POSITIVE_OPTIONS = [
    { value: 0 as const, label: "Slecht" },
    { value: 1 as const, label: "Matig" },
    { value: 2 as const, label: "Goed" },
]

const NEGATIVE_OPTIONS = [
    { value: 0 as const, label: "Geen" },
    { value: 1 as const, label: "Enig" },
    { value: 2 as const, label: "Veel" },
]

export function ScoreButton({
    indicator,
    direction,
    value,
    onChange,
    disabled = false,
}: ScoreButtonProps) {
    const options = direction === "negative" ? NEGATIVE_OPTIONS : POSITIVE_OPTIONS

    return (
        <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label={indicator}>
            {options.map((option) => {
                const color = indicatorScoreColor(option.value, direction)
                const selected = option.value === value

                return (
                    <Button
                        key={option.value}
                        type="button"
                        variant="outline"
                        disabled={disabled}
                        aria-pressed={selected}
                        className={cn(
                            "h-14 flex-col border-2 text-sm",
                            selected
                                ? cn(
                                      "shadow-sm hover:bg-transparent",
                                      BCS_COLOR_CLASSES[color],
                                  )
                                : "border-border bg-background text-muted-foreground hover:bg-accent",
                        )}
                        onClick={() => onChange(option.value)}
                    >
                        <span className="font-semibold">{option.label}</span>
                        <span className="text-xs opacity-80">Score {option.value}</span>
                    </Button>
                )
            })}
        </div>
    )
}
