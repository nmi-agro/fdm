import { Sprout } from "lucide-react"
import { NavLink } from "react-router"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import type { CultivationSuggestion } from "~/lib/cultivation-suggestion.server"

/**
 * Builds the URL to the field's cultivation page with the suggestion pre-filled as query
 * params, consumed by the "add cultivation" dialog to auto-open pre-filled.
 */
function buildAcceptSuggestionUrl(
  b_id_farm: string,
  calendar: string,
  b_id: string,
  suggestion: CultivationSuggestion,
) {
  const params = new URLSearchParams({
    suggest_b_lu_catalogue: suggestion.b_lu_catalogue,
    suggest_start: `${calendar}-01-01`,
  })
  return `/farm/${b_id_farm}/${calendar}/field/${b_id}/cultivation?${params.toString()}`
}

type CultivationSuggestionProps = {
  b_id_farm: string
  calendar: string
  b_id: string
  /** Field name, shown for contexts that list multiple fields (e.g. the dashboard banner). */
  b_name?: string
  suggestion: CultivationSuggestion | undefined
}

/**
 * A non-dismissible inline suggestion for a field/year with no registered main cultivation,
 * sourced from the NMI Estimates endpoint's BRP cultivation guess. Renders `null` when there
 * is no suggestion (no NMI API key configured, no estimate for the year, or a lookup failure) —
 * callers can always render this component unconditionally.
 */
export function CultivationSuggestionBanner({
  b_id_farm,
  calendar,
  b_id,
  b_name,
  suggestion,
}: CultivationSuggestionProps) {
  if (!suggestion) {
    return null
  }

  return (
    <div className="border-primary/30 bg-primary/5 flex items-start gap-2 rounded-lg border p-3">
      <Sprout className="text-primary mt-0.5 h-4 w-4 shrink-0" />
      <div className="flex flex-1 flex-wrap items-center justify-between gap-2">
        <p className="text-sm">
          {b_name && <span className="font-medium">{b_name}: </span>}
          We denken dat hier <span className="font-medium">{suggestion.b_lu_name}</span> geteeld
          werd in {calendar}. Toevoegen als hoofdteelt?
        </p>
        <Button size="sm" variant="outline" asChild>
          <NavLink to={buildAcceptSuggestionUrl(b_id_farm, calendar, b_id, suggestion)}>
            Toevoegen als hoofdteelt
          </NavLink>
        </Button>
      </div>
    </div>
  )
}

/**
 * Compact variant of {@link CultivationSuggestionBanner} for dense contexts (e.g. a table cell).
 * Renders `null` when there is no suggestion.
 */
export function CultivationSuggestionBadge({
  b_id_farm,
  calendar,
  b_id,
  suggestion,
}: CultivationSuggestionProps) {
  if (!suggestion) {
    return null
  }

  return (
    <NavLink to={buildAcceptSuggestionUrl(b_id_farm, calendar, b_id, suggestion)}>
      <Badge
        variant="outline"
        className="border-primary/30 text-primary hover:bg-primary/10 gap-1"
        title={`We denken dat hier ${suggestion.b_lu_name} geteeld werd in ${calendar}. Toevoegen als hoofdteelt?`}
      >
        <Sprout className="h-3 w-3" />
        Voorstel: {suggestion.b_lu_name}
      </Badge>
    </NavLink>
  )
}
