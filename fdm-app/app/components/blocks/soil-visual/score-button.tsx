import { cn } from "~/lib/utils"

interface ScoreButtonProps {
    value: number
    selected: boolean
    onClick: () => void
    disabled?: boolean
    size?: "sm" | "md"
}

/**
 * Reusable BCS score button (0, 1, or 2).
 * Used in both the wizard and the detail edit form.
 */
export function ScoreButton({
    value,
    selected,
    onClick,
    disabled,
    size = "md",
}: ScoreButtonProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={cn(
                "rounded-lg border-2 font-bold transition-colors",
                size === "md" ? "h-14 w-14 text-lg" : "h-10 w-10 text-sm",
                selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background hover:bg-accent hover:text-accent-foreground",
                disabled && "opacity-50 cursor-not-allowed",
            )}
        >
            {value}
        </button>
    )
}
