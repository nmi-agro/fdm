import type { AgentAvailabilityStatus } from "@nmi-agro/fdm-helpdesk"
import { formatDate } from "date-fns"
import { nl } from "date-fns/locale"
import { CircleCheck, CircleArrowLeft } from "lucide-react"
import { cn } from "@/app/lib/utils"

const ABSENCE_MESSAGE = {
  holiday: "Op vakantie",
  day_off: "Heeft een vrije dag",
  sick: "Is ziek",
  other: "Afwezig",
}

export function AgentAvailabilityDisplay({
  availability,
  className,
}: {
  /** The agent's availability status, from `getAgentAvailabilityStatuses`. Treated as available when omitted. */
  availability?: AgentAvailabilityStatus | null
  className?: string
}) {
  const absence = availability?.absence ?? null
  const worksToday = availability?.worksToday ?? true
  const isUnavailable = !!absence || !worksToday
  return (
    <div
      className={cn("text-muted-foreground flex flex-row items-center gap-1 text-sm", className)}
    >
      {isUnavailable ? (
        <CircleArrowLeft className="size-[1.2em] text-amber-600" />
      ) : (
        <CircleCheck className="size-[1.2em] text-green-600" />
      )}
      {absence
        ? `${ABSENCE_MESSAGE[absence.reason as keyof typeof ABSENCE_MESSAGE] ?? absence.reason} t/m ${formatDate(absence.end_date, "PP", { locale: nl })}${absence.note ? `: ${absence.note}` : ""}`
        : worksToday
          ? "Beschikbaar"
          : "Werkt vandaag niet"}
    </div>
  )
}
