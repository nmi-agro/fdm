import { useSearchParams } from "react-router"
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

/**
 * Parses the `?categories=` URL param into a validated IndicatorCategory array.
 * Returns an empty array when no filter is active (= show all).
 */
export function parseActiveCategories(
    searchParams: URLSearchParams,
): IndicatorCategory[] {
    const raw = searchParams.get("categories") ?? ""
    return raw
        .split(",")
        .map((s) => s.trim())
        .filter((s): s is IndicatorCategory =>
            INDICATOR_CATEGORIES.includes(s as IndicatorCategory),
        )
}

/**
 * Pill-shaped multi-select filter chips for indicator categories.
 * Selection is stored in the `?categories=Chemisch,Fysisch` URL param so it
 * is preserved when sharing or navigating back.
 *
 * Click a chip to toggle it on/off. "Alle" clears the selection (= show all).
 */
export function CategoryFilter() {
    const [searchParams, setSearchParams] = useSearchParams()
    const activeCategories = parseActiveCategories(searchParams)

    const toggle = (cat: IndicatorCategory) => {
        setSearchParams(
            (prev) => {
                const current = parseActiveCategories(prev)
                const next = current.includes(cat)
                    ? current.filter((c) => c !== cat)
                    : [...current, cat]
                if (next.length === 0) prev.delete("categories")
                else prev.set("categories", next.join(","))
                return prev
            },
            { preventScrollReset: true },
        )
    }

    const clearAll = () => {
        setSearchParams(
            (prev) => {
                prev.delete("categories")
                return prev
            },
            { preventScrollReset: true },
        )
    }

    const allActive = activeCategories.length === 0

    return (
        <div className="flex flex-wrap items-center gap-2">
            <button
                type="button"
                onClick={clearAll}
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
                        onClick={() => toggle(cat)}
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
