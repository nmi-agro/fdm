import type { SeasonPhase } from "@nmi-agro/fdm-calculator"
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group"
import { PHASE_LABELS } from "~/lib/mineralization"

const PHASES: SeasonPhase[] = ["planning", "growing", "evaluation"]

/**
 * Switches between the three moments of the season. The phase of today is marked "(nu)", but only
 * in the current year; phases that do not apply can be disabled with an explanation.
 */
export function PhaseSelector({
  value,
  currentPhase,
  disabled = {},
  onChange,
}: {
  value: SeasonPhase
  /** Phase that matches today; `null` when the selected year is not the current year. */
  currentPhase: SeasonPhase | null
  /** Phases that cannot be chosen, with the reason shown as hint. */
  disabled?: Partial<Record<SeasonPhase, string>>
  onChange: (phase: SeasonPhase) => void
}) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      value={value}
      onValueChange={(next) => {
        if (next) onChange(next as SeasonPhase)
      }}
      aria-label="Moment in het seizoen"
      className="w-full sm:w-auto"
    >
      {PHASES.map((phase) => (
        <ToggleGroupItem
          key={phase}
          value={phase}
          disabled={disabled[phase] !== undefined}
          title={disabled[phase]}
          className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground flex-1 px-3 sm:flex-none pointer-coarse:h-11"
        >
          {PHASE_LABELS[phase]}
          {phase === currentPhase ? (
            <span className="ml-1 text-xs font-normal opacity-70">(nu)</span>
          ) : null}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
