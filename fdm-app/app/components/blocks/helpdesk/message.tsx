import type { Message as MessageT } from "@nmi-agro/fdm-helpdesk"
import type { ReactNode } from "react"
import { formatDate, formatDistanceToNow } from "date-fns"
import { nl } from "date-fns/locale"
import { cn } from "@/app/lib/utils"
import { Card } from "~/components/ui/card"
import type { HelpdeskUser } from "./types"
import { HelpdeskUserAvatar } from "./helpdesk-user"

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
        "px-2 py-4 md:ms-10",
        isInternal && "border-amber-100 bg-amber-100/35",
        className,
      )}
    >
      <div className="text-muted-foreground relative flex flex-row items-center gap-2">
        <HelpdeskUserAvatar
          className="md: static size-6 md:absolute! md:top-1/2 md:-left-10 md:-translate-y-1/2"
          type={senderType}
          user={principal}
        />
        {title ?? (
          <span>
            {principal?.displayUserName ?? "Onbekende verzender"}{" "}
            {isInternal && <i className="text-sm italic">(Intern)</i>}
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
        <div className="text-muted-foreground text-[0.8rem]">Medewerker</div>
      )}
      <div className="mt-4">{children}</div>
    </Card>
  )
}
