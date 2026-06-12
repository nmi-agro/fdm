import type { Ticket } from "@nmi-agro/fdm-helpdesk"
import {
    ChevronDown,
    CircleCheck,
    CircleDot,
    CircleHelp,
    CirclePause,
    CirclePlay,
    CircleX,
} from "lucide-react"
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

export const TICKET_STATUS = [
    {
        value: "open",
        label: "Ontvangen",
        color: "#3b82f6", // blue-500
        icon: CircleDot,
    },
    {
        value: "in_progress",
        label: "In behandeling",
        color: "#6366f1", // indigo-500
        icon: CirclePlay,
    },
    {
        value: "pending",
        label: "Wordt nagevraagd",
        color: "#f59e0b", // amber-500
        icon: CirclePause,
    },
    {
        value: "waiting_on_customer",
        label: "Wachten op reactie",
        color: "#f97316", // orange-500
        icon: CircleHelp,
    },
    {
        value: "resolved",
        label: "Opgelost",
        color: "#22c55e", // green-500
        icon: CircleCheck,
    },
    {
        value: "closed",
        label: "Gesloten",
        color: "#6b7280", // gray-500
        icon: CircleX,
    },
]

export const TICKET_STATUS_DESCRIPTIONS: Record<string, string> = {
    open: "Uw vraag is ontvangen en wacht op behandeling door een medewerker.",
    in_progress: "Een medewerker is bezig met uw vraag.",
    pending: "We zijn aanvullende informatie aan het opvragen.",
    waiting_on_customer:
        "We wachten op een reactie van u. Voeg een bericht toe hieronder.",
    resolved: "Uw vraag is beantwoord. Neem contact op als u nog vragen heeft.",
    closed: "Dit ticket is gesloten.",
}

export const ALLOWED_TICKET_STATUS_TRANSITIONS: Record<string, string[]> = {
    open: [
        "in_progress",
        "pending",
        "waiting_on_customer",
        "resolved",
        "closed",
    ],
    in_progress: ["pending", "waiting_on_customer", "resolved", "closed"],
    pending: ["in_progress", "waiting_on_customer", "resolved", "closed"],
    waiting_on_customer: ["in_progress", "resolved", "closed"],
    resolved: ["closed", "open"], // "open" = reopen
    closed: ["open"], // "open" = reopen
}

/**
 * An circular icon indicating the ticket status with its shape and color
 * @param param0
 * @returns
 */
export function TicketStatusDot({
    ticket,
    className,
}: {
    ticket: Pick<Ticket, "status" | "closed_at">
    className?: string
}) {
    const statusEntry = TICKET_STATUS.find(
        (item) => item.value === ticket.status,
    )
    const statusColor = statusEntry?.color ?? "#6b7280"
    const statusLabel = statusEntry?.label ?? ticket.status
    const Icon = statusEntry?.icon ?? CircleDot
    return (
        <Icon
            className={cn("size-4 shrink-0", className)}
            style={{ color: statusColor }}
            aria-label={statusLabel}
        />
    )
}

/**
 * A dropdown where an agent can select a new ticket status
 *
 * The options are filtered based on the allowed status transitions from the current state.
 */
export function TicketStatusSelector({
    triggerId,
    canModify,
    status,
}: {
    /** ID for the button which opens the dropdown. Useful when adding a label. */
    triggerId?: string
    /** Whether to enable reselection */
    canModify: boolean
    /** Current ticket status. A form is submitted to change this. */
    status: string
}) {
    const fetcher = useFetcher()

    const statusEntry = TICKET_STATUS.find((item) => item.value === status)
    const statusColor = statusEntry?.color ?? "#6b7280"
    const statusLabel = statusEntry?.label ?? status
    const StatusIcon = statusEntry?.icon ?? CircleDot
    const allowedStatusTransitions =
        ALLOWED_TICKET_STATUS_TRANSITIONS[status] ?? []

    return (
        <DropdownMenu>
            <div className="flex flex-row items-center gap-2">
                <DropdownMenuTrigger asChild>
                    <Button
                        id={triggerId}
                        variant="outline"
                        size="sm"
                        className="gap-2 font-medium"
                        disabled={
                            !canModify ||
                            fetcher.state !== "idle" ||
                            allowedStatusTransitions.length === 0
                        }
                    >
                        <StatusIcon
                            className="size-4 shrink-0"
                            style={{ color: statusColor }}
                        />
                        {statusLabel}
                        {allowedStatusTransitions.length > 0 && (
                            <ChevronDown className="size-3 opacity-50 ms-1" />
                        )}
                    </Button>
                </DropdownMenuTrigger>
                <Spinner
                    className={cn(fetcher.state === "idle" && "invisible")}
                />
            </div>
            <DropdownMenuContent align="start">
                {TICKET_STATUS.filter((item) =>
                    allowedStatusTransitions.includes(item.value),
                ).map((item) => (
                    <DropdownMenuItem
                        key={item.value}
                        className="gap-2"
                        onClick={() => {
                            const formData = new FormData()
                            formData.append("intent", "set_ticket_status")
                            formData.append("status", item.value)
                            fetcher.submit(formData, {
                                method: "post",
                            })
                        }}
                    >
                        <item.icon
                            className="size-4 shrink-0"
                            style={{ color: item.color }}
                        />
                        {item.label}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
