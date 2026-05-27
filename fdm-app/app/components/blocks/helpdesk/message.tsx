import type { Message as MessageT } from "@nmi-agro/fdm-helpdesk"
import { User } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/app/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar"
import { Card } from "~/components/ui/card"
import type { HelpdeskUser } from "./types"

export type MessageExtended = MessageT & { principal: HelpdeskUser | null }
export function Message({
    title,
    principal,
    className,
    children,
}: {
    title?: ReactNode
    principal: HelpdeskUser | null
    className?: string
    children: ReactNode
}) {
    return (
        <Card
            className={cn("relative md:ms-10 px-2 py-4 space-y-4", className)}
        >
            <p className="flex flex-row gap-2 text-muted-foreground">
                <Avatar className="static md:absolute! md:-left-10 md: top-4 size-6">
                    <AvatarImage src={principal?.image ?? undefined} />
                    <AvatarFallback>
                        {principal?.initials ?? <User />}
                    </AvatarFallback>
                </Avatar>
                {title ?? principal?.displayUserName ?? "Onbekende Verzender"}
            </p>
            {children}
        </Card>
    )
}
