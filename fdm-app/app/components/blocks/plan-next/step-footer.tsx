import type { SeasonPlanStep } from "@nmi-agro/fdm-core"
import type { ReactNode } from "react"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { NavLink } from "react-router"
import { Button } from "~/components/ui/button"
import { Separator } from "~/components/ui/separator"
import { getAdjacentPlanNextSteps, getPlanNextPath } from "./steps"

/**
 * Footer of a step of the season planning wizard: back to the previous step, skip to the next
 * step without saving, and a primary action. When no primary action is given, the primary button
 * goes to the next step (or back to the farm after the last step).
 */
export function PlanNextStepFooter({
  b_id_farm,
  year,
  step,
  primary,
}: {
  b_id_farm: string
  year: number
  step: SeasonPlanStep
  /** The primary action, such as a submit button "Opslaan en verder". */
  primary?: ReactNode
}) {
  const { previous, next } = getAdjacentPlanNextSteps(step)

  return (
    <div className="space-y-4 pt-2">
      <Separator />
      <div className="flex flex-wrap items-center gap-2">
        {previous ? (
          <Button asChild variant="ghost">
            <NavLink to={getPlanNextPath(b_id_farm, year, previous.key)}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span>Terug</span>
            </NavLink>
          </Button>
        ) : null}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {next && primary ? (
            <Button asChild variant="outline">
              <NavLink to={getPlanNextPath(b_id_farm, year, next.key)}>
                <span>Overslaan</span>
              </NavLink>
            </Button>
          ) : null}
          {primary ??
            (next ? (
              <Button asChild>
                <NavLink to={getPlanNextPath(b_id_farm, year, next.key)}>
                  <span>Verder</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </NavLink>
              </Button>
            ) : (
              <Button asChild>
                <NavLink to={`/farm/${b_id_farm}`}>
                  <span>Naar bedrijf</span>
                </NavLink>
              </Button>
            ))}
        </div>
      </div>
    </div>
  )
}
