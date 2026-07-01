import type {
  Agent,
  Message as MessageT,
  PriorityString,
  TagSummary,
  Ticket as TicketT,
} from "@nmi-agro/fdm-helpdesk"
import { format } from "date-fns"
import { nl } from "date-fns/locale"
import { CircleDot } from "lucide-react"
import { useEffect, useId } from "react"
import { useNavigation, useSubmit } from "react-router"
import { cn } from "@/app/lib/utils"
import { Message } from "~/components/blocks/helpdesk/message"
import { Spinner } from "~/components/ui/spinner"
import type { HelpdeskUser } from "./types"
import { AssignmentSelector } from "./assignee-dialog"
import { MessageComposer } from "./message-composer"
import { TICKET_PRIORITY, TicketPrioritySelector } from "./ticket-priority"
import { TICKET_STATUS, TICKET_STATUS_DESCRIPTIONS, TicketStatusSelector } from "./ticket-status"
import { TicketSubjectEditor } from "./ticket-subject"
import { TicketTags } from "./ticket-tags"

export function Ticket({
  ticket,
  messages,
  agents = [],
  availableTags = [],
  canAddMessages,
  isAgent,
  principal_id,
  todayDate,
  contextFarmName,
  principalLookup,
}: {
  ticket: TicketT
  messages: MessageT[]
  agents?: Agent[]
  availableTags?: TagSummary[]
  canAddMessages: boolean
  isAgent: boolean
  principal_id: string
  todayDate: Date
  contextFarmName?: string | null
  principalLookup: Map<string, HelpdeskUser>
}) {
  const navigation = useNavigation()
  const submit = useSubmit()

  const assigneeSelectId = useId()
  const prioritySelectId = useId()

  const statusEntry = TICKET_STATUS.find((item) => item.value === ticket.status)
  const statusColor = statusEntry?.color ?? "#777777"
  const statusLabel = statusEntry?.label ?? ticket.status
  const StatusIcon = statusEntry?.icon ?? CircleDot

  const requesterName = ticket.requester_id
    ? (principalLookup.get(ticket.requester_id)?.displayUserName ?? ticket.requester_email)
    : ticket.requester_email

  const isViewed = !!ticket.viewed_at

  const emailPrincipal = ticket.requester_email
    ? {
        principal_id: ticket.ticket_id,
        displayUserName: ticket.requester_email,
        image: null,
        initials: null,
      }
    : null

  // Mark ticket as viewed if it wasn't viewed yet
  useEffect(() => {
    if (!isViewed) {
      const formData = new FormData()
      formData.append("intent", "mark_ticket_as_viewed")
      void submit(formData, { method: "POST" })
    }
  }, [isViewed, submit])

  return (
    <main className="space-y-6 p-6">
      <header className="space-y-4">
        {/* 1. Meta line — muted, middot-separated */}
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="font-mono">{ticket.ticket_ref}</span>
          <span aria-hidden="true">·</span>
          <span>Aangemaakt op {format(ticket.created, "PP", { locale: nl })}</span>
          {ticket.updated && (
            <>
              <span aria-hidden="true">·</span>
              <span>Bijgewerkt op {format(ticket.updated, "PP", { locale: nl })}</span>
            </>
          )}
          {requesterName && (
            <>
              <span aria-hidden="true">·</span>
              <span>door {requesterName}</span>
            </>
          )}
          {contextFarmName && (
            <>
              <span aria-hidden="true">·</span>
              <span>Bedrijf: {contextFarmName}</span>
            </>
          )}
        </div>

        {/* 2. Title */}
        <TicketSubjectEditor subject={ticket.subject ?? undefined} canModify={isAgent} />

        {/* 3. State row */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {isAgent ? (
            <>
              <TicketStatusSelector canModify={isAgent} status={ticket.status} />
              <label htmlFor={assigneeSelectId} className="text-muted-foreground text-sm">
                Medewerker:
              </label>
              <AssignmentSelector
                triggerId={assigneeSelectId}
                formIntent="change_assignment"
                canModify={isAgent}
                assignees={ticket.assignees}
                agents={agents}
                principalLookup={principalLookup}
              />
              <label htmlFor={prioritySelectId} className="text-muted-foreground ms-6 text-sm">
                Prioriteit:
              </label>
              <TicketPrioritySelector
                triggerId={prioritySelectId}
                canModify={isAgent}
                priority={ticket.priority as PriorityString}
              />
            </>
          ) : (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm font-medium">
                <StatusIcon className="size-4 shrink-0" style={{ color: statusColor }} />
                {statusLabel}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm font-medium">
                Prioriteit:{" "}
                {TICKET_PRIORITY.find((item) => item.value === ticket.priority)?.label ??
                  ticket.priority}
              </span>
            </>
          )}
          <Spinner className={cn("ms-auto", navigation.state === "idle" && "invisible")} />
        </div>

        {/* 4. Ticket Tags */}
        {isAgent || ticket.tags.length > 0 ? (
          <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
            <div className="text-muted-foreground py-1 text-sm">Tags:</div>
            <TicketTags tags={ticket.tags} availableTags={availableTags} isAgent={isAgent} />
          </div>
        ) : null}

        {/* 5. Customer status description */}
        {!isAgent && TICKET_STATUS_DESCRIPTIONS[ticket.status] && (
          <p className="text-muted-foreground text-sm">
            {TICKET_STATUS_DESCRIPTIONS[ticket.status]}
          </p>
        )}
      </header>
      <div className="space-y-4">
        {messages.map((msg) => (
          <Message
            key={msg.message_id}
            principal={
              principalLookup.get(msg.sender_id) ??
              (msg.sender_id === ticket.ticket_id ? emailPrincipal : null) ??
              null
            }
            senderType={msg.sender_type}
            isInternal={msg.is_internal}
            date={msg.created}
            todayDate={todayDate}
          >
            <p
              className="text-sm whitespace-pre-wrap"
              dangerouslySetInnerHTML={{ __html: msg.body }}
            />
          </Message>
        ))}
        {canAddMessages && (
          <MessageComposer
            className="mt-8"
            intent="add_message"
            principal={principalLookup.get(principal_id) ?? null}
            showAgentControls={isAgent}
            defaultValues={{
              sender_role: isAgent ? "agent" : "customer",
              is_internal: false,
              body: "",
            }}
          />
        )}
      </div>
    </main>
  )
}
