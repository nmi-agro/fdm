import { getHelpdeskPermission, getTicketCount } from "@nmi-agro/fdm-helpdesk"
import { getSession } from "@/app/lib/auth.server"
import { handleLoaderError } from "@/app/lib/error"
import { fdm } from "@/app/lib/fdm.server"

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

        const statuses = ["open", "in_progress", "waiting_on_customer"]

        // TODO: Get the count of conjunction properly
        const [numNotViewed, numUnassigned] = await Promise.all([
            helpdeskReadPermission
                ? getTicketCount(fdm, session.principal_id, {
                      notViewedBy: [session.principal_id],
                      assignees: [session.principal_id],
                      statuses: statuses,
                  })
                : getTicketCount(fdm, session.principal_id, {
                      notViewedBy: [session.principal_id],
                      requesterIds: [session.principal_id],
                      statuses: statuses,
                  }),
            helpdeskReadPermission
                ? getTicketCount(fdm, session.principal_id, {
                      assigned: false,
                      statuses: statuses,
                  })
                : 0,
        ])

        return { numNotViewed: numNotViewed, numUnassigned: numUnassigned }
    } catch (err) {
        throw handleLoaderError(err)
    }
}
