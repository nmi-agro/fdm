import type { PriorityString } from "@nmi-agro/fdm-helpdesk"
import { ChevronDown } from "lucide-react"
import { useFetcher } from "react-router"
import { cn } from "@/app/lib/utils"
import { Button } from "~/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { Spinner } from "~/components/ui/spinner"

export const TICKET_PRIORITY = [
  {
    value: "low",
    label: "Laag",
  },
  {
    value: "normal",
    label: "Normaal",
  },
  {
    value: "high",
    label: "Hoog",
  },
  {
    value: "urgent",
    label: "Urgent",
  },
]

/**
 * A dropdown where an agent can select a new ticket priority.
 */
export function TicketPrioritySelector({
  triggerId,
  canModify,
  priority,
}: {
  /** ID for the button which opens the dropdown. Useful when adding a label. */
  triggerId?: string
  /** Whether to enable reselection */
  canModify: boolean
  /** Current ticket priority. A form is submitted to change this. */
  priority: PriorityString
}) {
  const fetcher = useFetcher()

  const priorityInfo = TICKET_PRIORITY.find((item) => item.value === priority) ?? {
    value: priority,
    label: priority,
  }

  return (
    <DropdownMenu>
      <div className="flex flex-row items-center gap-2">
        <DropdownMenuTrigger asChild>
          <Button
            id={triggerId}
            variant="outline"
            size="sm"
            className="gap-2 font-medium"
            disabled={!canModify || fetcher.state !== "idle"}
          >
            {priorityInfo.label}
            <ChevronDown className="ms-1 size-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <Spinner className={cn(fetcher.state === "idle" && "invisible")} />
      </div>
      <DropdownMenuContent align="start">
        {TICKET_PRIORITY.map((item) => (
          <DropdownMenuItem
            key={item.value}
            className="gap-2"
            onClick={() => {
              const formData = new FormData()
              formData.append("intent", "update_priority")
              formData.append("priority", item.value)
              void fetcher.submit(formData, {
                method: "post",
              })
            }}
          >
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
