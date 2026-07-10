import { AgentAbsence } from "@nmi-agro/fdm-helpdesk"
import { formatDate } from "date-fns"
import { nl } from "date-fns/locale"
import { Circle, CircleArrowLeft, CircleCheck, Clock } from "lucide-react"
import { cn } from "@/app/lib/utils"

const ABSENCE_MESSAGE = {
  holiday: "Op vakantie",
  day_off: "Heeft een dagje uit",
  sick: "Is ziek",
  other: "Afwezig",
}

export const AGENT_AVAILABILITY_STATUSES = [
  {
    value: "online",
    label: "Online",
    description: "Je bent nu beschikbaar om nieuwe tickets te behandelen.",
  },
  {
    value: "away",
    label: "Even weg",
    description: "Je kunt nog geen nieuwe tickets behandelen maar je bent zo weer terug.",
  },
  {
    value: "out-of-office",
    label: "Uit kantoor",
    description:
      "Je bent helemaal niet beschikbaar, en je tickets moeten opnieuw worden togewezen.",
  },
] as const

export function AgentAvailabilityDisplay({
  availability_status,
  absence,
  className,
}: {
  availability_status: string
  absence: AgentAbsence | null
  className?: string
}) {
  return (
    <div
      className={cn("text-muted-foreground flex flex-row items-center gap-1 text-sm", className)}
    >
      {absence || availability_status === "out-of-office" ? (
        <CircleArrowLeft className="size-[1.2em] text-purple-700" />
      ) : availability_status === "away" ? (
        <Clock className="size-[1.2em] text-yellow-700" />
      ) : availability_status === "online" ? (
        <CircleCheck className="size-[1.2em] text-green-600" />
      ) : (
        <Circle className="size-[1.2em] text-gray-400" />
      )}
      {absence
        ? `${ABSENCE_MESSAGE[absence.reason as keyof typeof ABSENCE_MESSAGE]} t/m ${formatDate(absence.end_date, "PP", { locale: nl })}${absence.note ? `: ${absence.note}` : ""}`
        : availability_status
          ? (AGENT_AVAILABILITY_STATUSES.find((status) => status.value === availability_status)
              ?.label ?? "")
          : ""}
    </div>
  )
}
