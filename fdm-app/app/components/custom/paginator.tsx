import {
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
} from "lucide-react"
import { type ReactNode, useRef, useState } from "react"
import { useLocation, useNavigate, useSearchParams } from "react-router"
import { modifySearchParams } from "@/app/lib/url-utils"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
} from "~/components/ui/pagination"

/**
 * Modifies the given path using `modifySearchParams`.
 * It sets `pageOffset` and `pageLimit` such that the given page is displayed.
 * No bounds checks happen.
 *
 * @param search current URL or path. May contain search params or a hash
 * @param pageSize page size to increment the `pageOffset` by
 * @param n page index to display, zero-based
 * @returns a new URL or path, similar in format to the value of the `search` argument
 */
export function getPageSearch(search: string, pageSize: number, n: number) {
    return modifySearchParams(search, (searchParams) => {
        if (typeof n === "number")
            searchParams.set("pageOffset", (n * pageSize).toString())
        searchParams.set("pageLimit", pageSize.toString())
    })
}

interface PaginatorProps {
    /*
     * Total number of items that `pageOffset` shouldn't go beyond. `pageLimit` will always be set to `pageSize`,
     * assuming the server automatically clamps it.
     */
    totalItems: number
    /**
     * How much to increment the `pageOffset` per page
     */
    pageSize: number
}

/**
 * Widget that manipulates the `pageOffset` and `pageLimit` search parameters,
 * assuming that these paginate the main list that is displayed on the page,
 * in order to let the user move between different pages of the list.
 */
export function Paginator({ totalItems, pageSize }: PaginatorProps) {
    const location = useLocation()
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()

    const deltaPages = 2
    const currentPage = Math.floor(
        Number.parseInt(searchParams.get("pageOffset") ?? "0", 10) / pageSize,
    )
    const firstPage = 0
    const lastPage = Math.ceil(totalItems / pageSize) - 1
    const firstDisplayedPage = Math.max(
        0,
        Math.min(lastPage - 2 * deltaPages - 1, currentPage - deltaPages),
    )
    const lastDisplayedPage = Math.min(
        lastPage,
        Math.max(firstPage + 2 * deltaPages + 1, currentPage + deltaPages),
    )

    const deltaPageButtons: ReactNode[] = []
    for (let page = firstDisplayedPage; page <= lastDisplayedPage; page++) {
        if (page === currentPage) {
            deltaPageButtons.push(
                <PaginationItem key={page}>
                    <PaginationCurrent
                        value={page}
                        onValueChange={(v) =>
                            navigate(
                                getPageSearch(location.search, pageSize, v),
                            )
                        }
                    />
                </PaginationItem>,
            )
        } else {
            deltaPageButtons.push(
                <PaginationItem key={page}>
                    <PaginationLink
                        size="default"
                        href={getPageSearch(location.search, pageSize, page)}
                    >
                        {page + 1}
                    </PaginationLink>
                </PaginationItem>,
            )
        }
    }

    return (
        <Pagination>
            <PaginationContent>
                <PaginationItem>
                    <PaginationLink
                        aria-label="Eerste pagina"
                        title="Eerste pagina"
                        size="default"
                        href={getPageSearch(
                            location.search,
                            pageSize,
                            firstPage,
                        )}
                    >
                        <ChevronsLeft className="h-4 w-4" />
                    </PaginationLink>
                </PaginationItem>
                <PaginationItem>
                    <PaginationLink
                        aria-label="Vorige pagina"
                        title="Vorige pagina"
                        size="default"
                        href={getPageSearch(
                            location.search,
                            pageSize,
                            currentPage - 1,
                        )}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </PaginationLink>
                </PaginationItem>
                {firstDisplayedPage > firstPage && <PaginationEllipsis />}
                {deltaPageButtons}
                {lastDisplayedPage < lastPage && <PaginationEllipsis />}
                <PaginationItem>
                    <PaginationLink
                        aria-label="Volgende pagina"
                        title="Volgende pagina"
                        size="default"
                        href={getPageSearch(
                            location.search,
                            pageSize,
                            currentPage + 1,
                        )}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </PaginationLink>
                </PaginationItem>
                <PaginationItem>
                    <PaginationLink
                        aria-label="Laatste pagina"
                        title="Laatste pagina"
                        size="default"
                        href={getPageSearch(
                            location.search,
                            pageSize,
                            lastPage,
                        )}
                    >
                        <ChevronsRight className="h-4 w-4" />
                    </PaginationLink>
                </PaginationItem>
            </PaginationContent>
        </Pagination>
    )
}

/**
 * Link button that can be clicked, which will turn it into a textbox and focus it,
 * letting the user enter a custom page number (1-based).
 */
function PaginationCurrent({
    value,
    onValueChange,
}: {
    value: number
    onValueChange: (v: number) => unknown
}) {
    const inputRef = useRef<HTMLInputElement>(null)
    const [active, setActive] = useState(false)
    return (
        <div className={"m-2"}>
            {active ? (
                <Input
                    ref={inputRef}
                    type="number"
                    defaultValue={value}
                    min={1}
                    size={3}
                    className="max-w-20"
                    onLoad={(e) => e.currentTarget.focus()}
                    onKeyDown={(e) => {
                        if (e.key !== "Enter") return
                        const enteredPage = Number.parseInt(
                            e.currentTarget.value,
                            10,
                        )
                        if (!Number.isInteger(enteredPage) || enteredPage < 1)
                            return
                        onValueChange(enteredPage - 1)
                        setActive(false)
                    }}
                    onBlur={() => {
                        setActive(false)
                    }}
                />
            ) : (
                <Button
                    variant="secondary"
                    onClick={() => {
                        setActive(true)
                        setTimeout(() => {
                            inputRef.current?.focus()
                        })
                    }}
                >
                    {value + 1}
                </Button>
            )}
        </div>
    )
}
