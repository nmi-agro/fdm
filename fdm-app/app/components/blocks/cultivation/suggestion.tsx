import { format } from "date-fns"
import { CircleHelp, Sprout } from "lucide-react"
import { NavLink } from "react-router"
import type {
  CultivationSuggestion,
  CultivationSuggestionResult,
} from "~/lib/cultivation-suggestion.server"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip"

/**
 * Builds the URL to the field's cultivation page with the suggestion pre-filled as query
 * params, consumed by the "add cultivation" dialog to auto-open pre-filled. Dates come from
 * the cultivation catalogue's default sowing/harvest dates (`getDefaultDatesOfCultivation`),
 * the same source used for RVO/shapefile field imports — not a fixed placeholder date.
 */
function buildAcceptSuggestionUrl(
  b_id_farm: string,
  calendar: string,
  b_id: string,
  suggestion: CultivationSuggestion,
) {
  const params = new URLSearchParams({
    suggest_b_lu_catalogue: suggestion.b_lu_catalogue,
    suggest_start: format(suggestion.b_lu_start, "yyyy-MM-dd"),
  })
  if (suggestion.b_lu_end) {
    params.set("suggest_end", format(suggestion.b_lu_end, "yyyy-MM-dd"))
  }
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
 * is no suggestion — callers can always render this component unconditionally.
 *
 * Deliberately styled as a *quiet, provisional* state (muted surface, not the `primary` token):
 * this is a guess, not a recorded fact, and shouldn't visually compete with real data. The
 * "BRP-schatting" label makes that provenance explicit rather than relying on prose alone.
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
    <div className="bg-muted/40 flex items-start gap-2 rounded-lg border p-3">
      <Sprout className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
      <div className="flex flex-1 flex-wrap items-center justify-between gap-2">
        <p className="text-sm">
          {b_name && <span className="font-medium">{b_name}: </span>}
          <Badge variant="secondary" className="mr-1.5 align-middle font-normal">
            BRP-schatting
          </Badge>
          We denken dat hier <span className="font-medium">{suggestion.b_lu_name}</span> geteeld
          werd in {calendar}, gebaseerd op de Basisregistratie Gewaspercelen. Toevoegen als
          hoofdteelt?
        </p>
        <Button size="sm" asChild>
          <NavLink to={buildAcceptSuggestionUrl(b_id_farm, calendar, b_id, suggestion)}>
            Voorstel toevoegen
          </NavLink>
        </Button>
      </div>
    </div>
  )
}

/**
 * Compact variant of {@link CultivationSuggestionBanner} for dense contexts (e.g. a table cell).
 * Renders `null` when there is no suggestion. Truncated to a fixed max-width so a long crop
 * name never sprawls a table row; the full name is always available via the tooltip.
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
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <NavLink
            to={buildAcceptSuggestionUrl(b_id_farm, calendar, b_id, suggestion)}
            className="max-w-[10rem]"
          >
            <Badge
              variant="secondary"
              className="hover:bg-secondary/70 flex min-w-0 items-center gap-1"
            >
              <Sprout className="h-3 w-3 shrink-0" />
              <span className="min-w-0 truncate">BRP: {suggestion.b_lu_name}</span>
            </Badge>
          </NavLink>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            BRP-schatting: {suggestion.b_lu_name} ({calendar}). Klik om toe te voegen als
            hoofdteelt.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

type CultivationSuggestionStatusProps = {
  b_id_farm: string
  calendar: string
  b_id: string
  b_name?: string
  result: CultivationSuggestionResult
}

/**
 * Full-status variant for the highest-visibility surfaces (farm dashboard, field detail):
 * distinguishes "here's a suggestion" from "we couldn't determine one" so a silent NMI failure
 * never looks identical to "nothing to suggest". Renders nothing when the feature is fully
 * disabled (`not_configured`) so self-hosted instances without an NMI subscription never see
 * any trace of it.
 */
export function CultivationSuggestionStatusBanner({
  b_id_farm,
  calendar,
  b_id,
  b_name,
  result,
}: CultivationSuggestionStatusProps) {
  if (result.status === "not_configured") {
    return null
  }

  if (result.status === "suggested") {
    return (
      <CultivationSuggestionBanner
        b_id_farm={b_id_farm}
        calendar={calendar}
        b_id={b_id}
        b_name={b_name}
        suggestion={result.suggestion}
      />
    )
  }

  const message =
    result.status === "no_estimate"
      ? "Geen BRP-schatting beschikbaar voor dit jaar."
      : "De BRP-schatting kon niet worden opgehaald. Probeer het later opnieuw."

  return (
    <div className="text-muted-foreground flex items-start gap-2 rounded-lg border border-dashed p-3 text-sm">
      <CircleHelp className="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        {b_name && <span className="font-medium">{b_name}: </span>}
        {message}
      </p>
    </div>
  )
}
