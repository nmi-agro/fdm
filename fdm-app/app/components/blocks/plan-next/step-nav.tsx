import { Circle, CircleCheck } from "lucide-react"
import { NavLink, useLocation } from "react-router"
import type { SeasonPlanStepSummary } from "~/lib/season-plan.server"
import { buttonVariants } from "~/components/ui/button"
import { cn } from "~/lib/utils"
import { getPlanNextPath, PLAN_NEXT_STEPS } from "./steps"

/**
 * Navigation between the steps of the season planning wizard. Each step shows whether it is done
 * or how many items are still open; every step can be opened at any time.
 */
export function PlanNextStepNav({
  b_id_farm,
  year,
  steps,
}: {
  b_id_farm: string
  year: number
  steps: Pick<SeasonPlanStepSummary, "step" | "done" | "pending">[]
}) {
  const { pathname } = useLocation()

  return (
    <nav
      aria-label="Stappen"
      className="flex space-x-2 overflow-x-auto pb-2 lg:flex-col lg:space-y-1 lg:space-x-0 lg:overflow-visible lg:pb-0"
    >
      {PLAN_NEXT_STEPS.map((step, index) => {
        const to = getPlanNextPath(b_id_farm, year, step.key)
        const isActive = pathname === to || pathname.startsWith(`${to}/`)
        const progress = steps.find((s) => s.step === step.key)
        const pending = progress?.pending ?? 0
        return (
          <NavLink
            key={step.key}
            to={to}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              isActive ? "bg-muted hover:bg-muted" : "hover:bg-transparent hover:underline",
              "shrink-0 justify-start gap-2",
            )}
          >
            {progress?.done ? (
              <CircleCheck className="text-primary h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <Circle className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            <span>{`${index + 1}. ${step.title}`}</span>
            {pending > 0 ? (
              <span
                className="bg-secondary text-secondary-foreground ml-auto rounded-md px-1.5 text-xs"
                title={`${pending} open`}
              >
                {pending}
              </span>
            ) : null}
          </NavLink>
        )
      })}
    </nav>
  )
}
