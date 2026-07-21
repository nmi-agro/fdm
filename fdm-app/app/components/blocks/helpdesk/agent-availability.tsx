import { AgentAbsence } from "@nmi-agro/fdm-helpdesk"
import { formatDate } from "date-fns"
import { nl } from "date-fns/locale"
import { CircleCheck, CircleArrowLeft } from "lucide-react"
import { cn } from "@/app/lib/utils"

const ABSENCE_MESSAGE = {
  holiday: "Op vakantie",
  day_off: "Heeft een dagje uit",
  sick: "Is ziek",
  other: "Afwezig",
}

export function AgentAvailabilityDisplay({
  absence,
  className,
}: {
  absence: AgentAbsence | null
  className?: string
}) {
  return (
    <div
      className={cn("text-muted-foreground flex flex-row items-center gap-1 text-sm", className)}
    >
      {absence ? (
        <CircleArrowLeft className="size-[1.2em] text-purple-700" />
      ) : (
        <CircleCheck className="size-[1.2em] text-green-600" />
      )}
      {absence
        ? `${ABSENCE_MESSAGE[absence.reason as keyof typeof ABSENCE_MESSAGE] ?? absence.reason} t/m ${formatDate(absence.end_date, "PP", { locale: nl })}${absence.note ? `: ${absence.note}` : ""}`
        : "Beschikbaar"}
    </div>
  )
}
