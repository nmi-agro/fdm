import { ECOSYSTEEMDIENSTEN, type Ecosysteemdienst } from "~/lib/indicators"
import { cn } from "~/lib/utils"

const CHIP_ACTIVE: Record<Ecosysteemdienst, string> = {
  Productie:
    "border-orange-500 bg-orange-500 text-white dark:border-orange-600 dark:bg-orange-600 dark:text-white",
  Klimaat:
    "border-stone-500 bg-stone-500 text-white dark:border-stone-600 dark:bg-stone-600 dark:text-white",
  Water:
    "border-blue-500 bg-blue-500 text-white dark:border-blue-600 dark:bg-blue-600 dark:text-white",
  Nutriëntenkringloop:
    "border-violet-500 bg-violet-500 text-white dark:border-violet-600 dark:bg-violet-600 dark:text-white",
}

const CHIP_INACTIVE: Record<Ecosysteemdienst, string> = {
  Productie:
    "border-orange-400 bg-background text-orange-600 hover:bg-orange-50 dark:border-orange-600/50 dark:text-orange-400 dark:hover:bg-orange-950/30",
  Klimaat:
    "border-stone-400 bg-background text-stone-600 hover:bg-stone-50 dark:border-stone-600/50 dark:text-stone-400 dark:hover:bg-stone-950/30",
  Water:
    "border-blue-400 bg-background text-blue-600 hover:bg-blue-50 dark:border-blue-600/50 dark:text-blue-400 dark:hover:bg-blue-950/30",
  Nutriëntenkringloop:
    "border-violet-400 bg-background text-violet-600 hover:bg-violet-50 dark:border-violet-600/50 dark:text-violet-400 dark:hover:bg-violet-950/30",
}

const chipBase =
  "rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
const chipAllInactive =
  "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
const chipAllActive = "border-foreground bg-foreground text-background"

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
export function CategoryFilter({ activeCategories, onToggle, onClearAll }: CategoryFilterProps) {
  const allActive = activeCategories.length === 0

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onClearAll}
        className={cn(chipBase, allActive ? chipAllActive : chipAllInactive)}
      >
        Alle
      </button>

      {ECOSYSTEEMDIENSTEN.map((dienst) => {
        const isActive = allActive || activeCategories.includes(dienst)
        return (
          <button
            key={dienst}
            type="button"
            onClick={() => onToggle(dienst)}
            className={cn(chipBase, isActive ? CHIP_ACTIVE[dienst] : CHIP_INACTIVE[dienst])}
          >
            {dienst}
          </button>
        )
      })}
    </div>
  )
}
