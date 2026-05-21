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

interface PaginatorProps {
    totalItems: number
    pageSize: number
}

export function getPageSearch(search: string, pageSize: number, n?: number) {
    return modifySearchParams(search, (searchParams) => {
        if (typeof n === "number")
            searchParams.set("pageOffset", (n * pageSize).toString())
        searchParams.set("pageLimit", pageSize.toString())
    })
}

export function Paginator({ totalItems, pageSize }: PaginatorProps) {
    const location = useLocation()
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()

    const deltaPages = 2
    const currentPage = Math.floor(
        Number.parseInt(searchParams.get("pageOffset") ?? "", 10) / pageSize,
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
                <PaginationItem key={`${page}`}>
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
                <PaginationItem>
                    <PaginationLink
                        size="default"
                        href={getPageSearch(location.search, pageSize, page)}
                    />
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

function PaginationCurrent({
    value,
    onValueChange,
}: {
    value: number
    onValueChange: (v: number) => unknown
}) {
    const inputRef = useRef<HTMLInputElement>(null)
    const [active, setActive] = useState(false)
    return active ? (
        <Input
            ref={inputRef}
            type="number"
            onLoad={(e) => e.currentTarget.focus()}
            onKeyDown={(e) => {
                if (e.key !== "Enter") return
                let newValue = 0
                try {
                    newValue = Number.parseInt(e.currentTarget.value)
                } catch (_) {
                    return
                }
                onValueChange(newValue)
                setActive(false)
            }}
            onBlur={() => {
                setActive(false)
            }}
        />
    ) : (
        <Button
            variant="link"
            onClick={() => {
                setActive(true)
                setTimeout(() => {
                    inputRef.current?.focus()
                })
            }}
        >
            {value + 1}
        </Button>
    )
}
