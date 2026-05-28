import { ECOSYSTEEMDIENSTEN, type Ecosysteemdienst } from "~/lib/indicators"
import { cn } from "~/lib/utils"

const CHIP_ACTIVE: Record<Ecosysteemdienst, string> = {
    Gewasproductie:
        "border-orange-400 bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400",
    Koolstofvastlegging:
        "border-stone-400 bg-stone-50 text-stone-700 dark:bg-stone-950/30 dark:text-stone-400",
    Waterkwaliteit:
        "border-blue-400 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400",
    Nutriëntenkringloop:
        "border-violet-400 bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400",
}

const chipBase =
    "rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
const chipInactive =
    "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
const chipAllActive = "border-foreground bg-muted text-foreground"

type CategoryFilterProps = {
    /** Currently active ecosystem services (empty = show all). */
    activeCategories: Ecosysteemdienst[]
    /** Called when an ecosystem service chip is toggled. */
    onToggle: (ecosysteemdienst: Ecosysteemdienst) => void
    /** Called when "Alle" is clicked. */
    onClearAll: () => void
}

/**
 * Pill-shaped multi-select filter chips for ecosystem services.
 * Driven by props — parent owns the state for instant client-side filtering.
 */
export function CategoryFilter({
    activeCategories,
    onToggle,
    onClearAll,
}: CategoryFilterProps) {
    const allActive = activeCategories.length === 0

    return (
        <div className="flex flex-wrap items-center gap-2">
            <button
                type="button"
                onClick={onClearAll}
                className={cn(
                    chipBase,
                    allActive ? chipAllActive : chipInactive,
                )}
            >
                Alle
            </button>

            {ECOSYSTEEMDIENSTEN.map((dienst) => {
                const isActive = activeCategories.includes(dienst)
                return (
                    <button
                        key={dienst}
                        type="button"
                        onClick={() => onToggle(dienst)}
                        className={cn(
                            chipBase,
                            isActive ? CHIP_ACTIVE[dienst] : chipInactive,
                        )}
                    >
                        {dienst}
                    </button>
                )
            })}
        </div>
    )
}
