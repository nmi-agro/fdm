import { getHelpdeskPermission, getTicketCount } from "@nmi-agro/fdm-helpdesk"
import { getSession } from "@/app/lib/auth.server"
import { handleLoaderError } from "@/app/lib/error"
import { fdm } from "@/app/lib/fdm.server"
import { TICKET_STATUS } from "~/components/blocks/helpdesk/ticket"

export async function sidebarSupportLoader({ request }: { request: Request }) {
    try {
        const session = await getSession(request)

        const helpdeskReadPermission = await getHelpdeskPermission(
            fdm,
            "helpdesk",
            "read",
            "",
            session.principal_id,
        )

        const openColor =
            TICKET_STATUS.find((item) => item.value === "open")?.color ??
            "#00aa00"
        const statuses = TICKET_STATUS.filter(
            (item) => item.color === openColor,
        ).map((item) => item.value)

        // TODO: Get the count of conjunction properly
        const numNotViewed = helpdeskReadPermission
            ? await getTicketCount(fdm, session.principal_id, {
                  notViewedBy: [session.principal_id],
                  assignees: [session.principal_id],
                  statuses: statuses,
              })
            : await getTicketCount(fdm, session.principal_id, {
                  notViewedBy: [session.principal_id],
                  requesterIds: [session.principal_id],
                  statuses: statuses,
              })

        const numUnassigned = helpdeskReadPermission
            ? await getTicketCount(fdm, session.principal_id, {
                  assigned: false,
                  statuses: statuses,
              })
            : 0

        return { numNotViewed: numNotViewed, numUnassigned: numUnassigned }
    } catch (err) {
        throw handleLoaderError(err)
    }
}
