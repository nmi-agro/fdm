import type { PaginationFilter } from "./filter.types"

/**
 * FDM Helpdesk enforces the use of pages when listing a resource, even though the length of the requested
 * page doesn't matter. This function overrides the user's page request if they haven't specified it properly.
 *
 * @param filters Filter object that would contain the pagination filters.
 * @param defaultPageLimit Number of records to return if the pageLimit isn't provided in the filters.
 * `20` by default. `0` may be supplied to disable page limiting.
 */
export function getPageOffsetAndLimit(filters?: PaginationFilter, defaultPageLimit = 20) {
  const pageOffset =
    typeof filters?.pageOffset === "number" && Number.isFinite(filters.pageOffset)
      ? Math.max(0, filters.pageOffset)
      : 0
  const pageLimit =
    typeof filters?.pageLimit === "number" && Number.isFinite(filters.pageLimit)
      ? Math.max(1, filters.pageLimit)
      : defaultPageLimit <= 0
        ? undefined
        : defaultPageLimit
  return { pageOffset, pageLimit }
}
