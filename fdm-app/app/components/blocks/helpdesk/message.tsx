import type { Message as MessageT } from "@nmi-agro/fdm-helpdesk"
import { formatDate, formatDistanceToNow } from "date-fns"
import { nl } from "date-fns/locale"
import type { ReactNode } from "react"
import { cn } from "@/app/lib/utils"
import { Card } from "~/components/ui/card"
import { HelpdeskUserAvatar } from "./helpdesk-user"
import type { HelpdeskUser } from "./types"

export type MessageExtended = MessageT & { principal: HelpdeskUser | null }
export function Message({
  title,
  principal,
  date,
  todayDate,
  senderType,
  isInternal = false,
  className,
  children,
}: {
  title?: ReactNode
  principal: HelpdeskUser | null
  date?: Date
  todayDate?: Date
  senderType?: string
  isInternal?: boolean
  className?: string
  children: ReactNode
}) {
  const formattedDateTooltip = date ? formatDate(date, "PP HH:mm", { locale: nl }) : null
  const formattedDateDisplay =
    date && todayDate
      ? `${formatDistanceToNow(date, { locale: nl })} geleden`
      : formattedDateTooltip
  return (
    <Card
      className={cn(
        "md:ms-10 px-2 py-4",
        isInternal && "border-amber-100 bg-amber-100/35",
        className,
      )}
    >
      <div className="relative flex flex-row gap-2 items-center text-muted-foreground">
        <HelpdeskUserAvatar
          className="static size-6 md:absolute! md:-left-10 md: md:top-1/2 md:-translate-y-1/2"
          type={senderType}
          user={principal}
        />
        {title ?? (
          <span>
            {principal?.displayUserName ?? "Onbekende verzender"}{" "}
            {isInternal && <i className="italic text-sm">(Intern)</i>}
          </span>
        )}
        <div className="ms-auto">
          {formattedDateTooltip && (
            <span
              className="text-sm"
              title={
                (formattedDateDisplay !== formattedDateTooltip ? formattedDateTooltip : null) ??
                undefined
              }
            >
              {formattedDateDisplay}
            </span>
          )}
        </div>
      </div>
      {senderType === "agent" && (
        <div className="text-[0.8rem] text-muted-foreground">Medewerker</div>
      )}
      <div className="mt-4">{children}</div>
    </Card>
  )
}
