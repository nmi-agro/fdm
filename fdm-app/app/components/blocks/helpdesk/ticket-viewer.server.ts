import { getPrincipals } from "@nmi-agro/fdm-core"
import {
    getTicketCount,
    getTickets,
    type Ticket,
    type TicketFilters,
} from "@nmi-agro/fdm-helpdesk"
import { data, redirect } from "react-router"
import { TicketFilterSchema } from "~/components/blocks/helpdesk/ticket-filter-schema"
import { TICKET_VIEWER_PAGE_SIZE } from "~/components/blocks/helpdesk/ticket-viewer"
import { getSession } from "~/lib/auth.server"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import type { HelpdeskUser } from "./types"

export type LoadPaginatedTicketsData = {
    tickets: Ticket[]
    totalTicketCount: number
    principals: HelpdeskUser[]
}

export async function loadPaginatedTickets(request: Request) {
    try {
        const url = new URL(request.url)
        let pageOffset: number | undefined
        let pageLimit: number | undefined

        try {
            const pageOffsetStr = url.searchParams.get("pageOffset")
            pageOffset = pageOffsetStr
                ? Number.parseInt(pageOffsetStr, 10)
                : undefined
            const pageLimitStr = url.searchParams.get("pageLimit")
            pageLimit = pageLimitStr
                ? Number.parseInt(pageLimitStr, 10)
                : undefined
        } catch (_) {
            throw data(null, { status: 400, statusText: "Bad Page Input" })
        }

        if (typeof pageOffset === "number" && pageOffset < 0) {
            const newSearchParams = new URLSearchParams(url.searchParams)
            newSearchParams.set("pageOffset", "0")
            newSearchParams.set("pageLimit", TICKET_VIEWER_PAGE_SIZE.toString())
            return redirect(`?${newSearchParams.toString()}`)
        }

        const {
            pageOffset: _pageOffset,
            pageLimit: _pageLimit,
            ...userFilters
        } = TicketFilterSchema.parse(
            JSON.parse(url.searchParams.get("filters") ?? "{}"),
        )
        const session = await getSession(request)

        const filters: TicketFilters = {
            ...userFilters,
            requesterIds: [
                ...(userFilters.requesterIds ?? []),
                session.principal_id,
            ],
        }

        const totalTicketCount = await getTicketCount(
            fdm,
            session.principal_id,
            filters,
        )

        if (typeof pageOffset === "number" && totalTicketCount <= pageOffset) {
            const newSearchParams = new URLSearchParams(url.searchParams)
            newSearchParams.set(
                "pageOffset",
                Math.max(
                    0,
                    (Math.ceil(totalTicketCount / TICKET_VIEWER_PAGE_SIZE) -
                        1) *
                        TICKET_VIEWER_PAGE_SIZE,
                ).toString(),
            )
            newSearchParams.set("pageLimit", TICKET_VIEWER_PAGE_SIZE.toString())
            return redirect(`?${newSearchParams.toString()}`)
        }

        const tickets = await getTickets(fdm, session.principal_id, {
            ...filters,
            pageOffset,
            pageLimit,
        })

        const principals = await getPrincipals(
            fdm,
            tickets
                .map((ticket) => ticket.requester_id)
                .filter((id) => id !== null)
                .concat([session.principal_id]),
        )

        const principalsSummarized = [...principals.values()].map(
            (principal) => ({
                principal_id: principal.id,
                displayUserName: principal.displayUserName,
                initials: principal.initials,
                image: principal.image,
            }),
        )

        return {
            tickets: tickets,
            totalTicketCount: totalTicketCount,
            principals: principalsSummarized,
        } satisfies LoadPaginatedTicketsData
    } catch (err) {
        throw handleLoaderError(err)
    }
}
