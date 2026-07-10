import { AgentAbsence, AgentSummary } from "@nmi-agro/fdm-helpdesk"
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
  agent,
  agentAbsence,
  className,
}: {
  agent: AgentSummary
  agentAbsence?: AgentAbsence
  className?: string
}) {
  return (
    <div
      className={cn("text-muted-foreground flex flex-row items-center gap-1 text-sm", className)}
    >
      {agentAbsence || agent.availability_status === "out-of-office" ? (
        <CircleArrowLeft className="size-[1.2em] text-purple-700" />
      ) : agent.availability_status === "away" ? (
        <Clock className="size-[1.2em] text-yellow-700" />
      ) : agent.availability_status === "online" ? (
        <CircleCheck className="size-[1.2em] text-green-600" />
      ) : (
        <Circle className="size-[1.2em] text-gray-400" />
      )}
      {agentAbsence
        ? `${ABSENCE_MESSAGE[agentAbsence.reason as keyof typeof ABSENCE_MESSAGE]} t/m ${formatDate(agentAbsence.end_date, "PP", { locale: nl })}${agentAbsence.note ? `: ${agentAbsence.note}` : ""}`
        : agent.availability_status
          ? (AGENT_AVAILABILITY_STATUSES.find(
              (status) => status.value === agent.availability_status,
            )?.label ?? "")
          : ""}
    </div>
  )
}
