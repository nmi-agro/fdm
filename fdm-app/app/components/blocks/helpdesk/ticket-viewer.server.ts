import { getPrincipals } from "@nmi-agro/fdm-core"
import {
    checkHelpdeskPermission,
    getTags,
    getTicketCount,
    getTickets,
    type TagSummary,
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
    defaultFilterType: "all" | "inbox" | "unassigned" | null
    tickets: Ticket[]
    totalTicketCount: number
    helpdeskReadPermission: boolean
    principals: HelpdeskUser[]
    availableTags: TagSummary[]
}

function mergeFilters(...filters: TicketFilters[]): TicketFilters {
    return mergeFiltersInner(filters.length, filters)
}

function mergeFiltersInner(
    end: number,
    filters: TicketFilters[],
): TicketFilters {
    if (end === 0) return {}
    if (end === 1) return filters[end - 1]
    const base = mergeFiltersInner(end - 1, filters)
    const current = filters[end - 1]
    const result: TicketFilters = {}

    if (base.assignees || current.assignees) {
        result.assignees = [
            ...(base.assignees ?? []),
            ...(current.assignees ?? []),
        ]
    }
    if (base.requesterIds || current.requesterIds) {
        result.requesterIds = [
            ...(base.requesterIds ?? []),
            ...(current.requesterIds ?? []),
        ]
    }
    if (base.fromDate || current.fromDate) {
        result.fromDate = current.fromDate ?? base.fromDate
    }
    if (base.toDate || current.toDate) {
        result.toDate = current.toDate ?? base.toDate
    }
    if (base.minPriority || current.minPriority) {
        result.minPriority = current.minPriority ?? base.minPriority
    }
    if (base.maxPriority || current.maxPriority) {
        result.maxPriority = current.maxPriority ?? base.maxPriority
    }
    if (base.tags || current.tags) {
        result.tags = [...(base.tags ?? []), ...(current.tags ?? [])]
    }
    return result
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

        const session = await getSession(request)

        const helpdeskReadPermission = await checkHelpdeskPermission(
            fdm,
            "helpdesk",
            "read",
            "",
            session.principal_id,
            "loadPaginatedTickets",
            false,
        )

        const {
            pageOffset: _pageOffset,
            pageLimit: _pageLimit,
            ...userFilters
        } = TicketFilterSchema.parse(
            JSON.parse(url.searchParams.get("filters") ?? "{}"),
        )

        const defaultFilterType = url.searchParams.has("all")
            ? "all"
            : url.searchParams.has("inbox")
              ? "inbox"
              : url.searchParams.has("unassigned")
                ? "unassigned"
                : null

        const defaultFilters: TicketFilters = !helpdeskReadPermission
            ? { requesterIds: [session.principal_id] }
            : defaultFilterType === "all"
              ? {}
              : defaultFilterType === "inbox"
                ? { assignees: [session.principal_id] }
                : defaultFilterType === "unassigned"
                  ? { assigned: false }
                  : { requesterIds: [session.principal_id] }

        const filters: TicketFilters = mergeFilters(defaultFilters, userFilters)

        const totalTicketCount = await getTicketCount(
            fdm,
            session.principal_id,
            filters,
        )

        if (
            typeof pageOffset === "number" &&
            totalTicketCount !== 0 &&
            totalTicketCount <= pageOffset
        ) {
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

        const availableTags = await getTags(fdm)

        return {
            defaultFilterType: defaultFilterType,
            tickets: tickets,
            totalTicketCount: totalTicketCount,
            principals: principalsSummarized,
            helpdeskReadPermission: helpdeskReadPermission,
            availableTags: availableTags,
        } satisfies LoadPaginatedTicketsData
    } catch (err) {
        throw handleLoaderError(err)
    }
}
