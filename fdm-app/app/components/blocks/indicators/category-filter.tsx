import { cn } from "~/lib/utils"
import { INDICATOR_CATEGORIES, type IndicatorCategory } from "~/lib/indicators"

const CHIP_ACTIVE: Record<IndicatorCategory, string> = {
    Biologisch:
        "border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
    Chemisch:
        "border-blue-400 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400",
    Fysisch:
        "border-stone-400 bg-stone-50 text-stone-700 dark:bg-stone-950/30 dark:text-stone-400",
    Grondwater:
        "border-cyan-400 bg-cyan-50 text-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-400",
    "Nutriënten":
        "border-green-400 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400",
    Oppervlaktewater:
        "border-sky-400 bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-400",
}

const chipBase =
    "rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
const chipInactive =
    "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
const chipAllActive =
    "border-foreground bg-muted text-foreground"

type CategoryFilterProps = {
    /** Currently active categories (empty = show all). */
    activeCategories: IndicatorCategory[]
    /** Called when a category chip is toggled. */
    onToggle: (category: IndicatorCategory) => void
    /** Called when "Alle" is clicked. */
    onClearAll: () => void
}

/**
 * Pill-shaped multi-select filter chips for indicator categories.
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

            {INDICATOR_CATEGORIES.map((cat) => {
                const isActive = activeCategories.includes(cat)
                return (
                    <button
                        key={cat}
                        type="button"
                        onClick={() => onToggle(cat)}
                        className={cn(
                            chipBase,
                            isActive ? CHIP_ACTIVE[cat] : chipInactive,
                        )}
                    >
                        {cat}
                    </button>
                )
            })}
        </div>
    )
}
