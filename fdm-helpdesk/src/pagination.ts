import type { PaginationFilter } from "./filter.types"

/**
 * FDM Helpdesk enforces the use of pages when listing a resource, even though the length of the requested
 * page doesn't matter. This function overrides the user's page request if they haven't specified it properly.
 *
 * @param filters
 */
export function getPageOffsetAndLimit(filters: PaginationFilter) {
    const pageOffset = filters?.pageOffset ? Math.max(0, filters.pageOffset) : 0
    const pageLimit = filters?.pageLimit ? Math.max(1, filters.pageLimit) : 20
    return { pageOffset, pageLimit }
}
