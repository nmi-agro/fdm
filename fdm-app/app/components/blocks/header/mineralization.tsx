import { ChevronDown } from "lucide-react"
import { NavLink, useLocation } from "react-router"
import { useCalendarStore } from "@/app/store/calendar"
import {
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbSeparator,
} from "~/components/ui/breadcrumb"
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"

type HeaderFieldOption = {
    b_id: string
    b_name: string | null | undefined
}

export function HeaderMineralization({
    b_id_farm,
    b_id,
    fieldOptions,
}: {
    b_id_farm: string
    b_id: string | undefined
    fieldOptions: HeaderFieldOption[]
}) {
    const calendar = useCalendarStore((state) => state.calendar)
    const location = useLocation()
    const isDyna = location.pathname.endsWith("/dyna")

    const selectedField = b_id
        ? fieldOptions.find((f) => f.b_id === b_id)
        : undefined

    return (
        <>
            <BreadcrumbSeparator className="hidden xl:block" />
            <BreadcrumbItem className="hidden xl:block">
                <BreadcrumbLink
                    href={`/farm/${b_id_farm}/${calendar}/mineralization`}
                >
                    Mineralisatie
                </BreadcrumbLink>
            </BreadcrumbItem>

            {b_id && (
                <>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <DropdownMenu>
                            <DropdownMenuTrigger className="flex items-center gap-1 max-w-[120px] sm:max-w-[200px] md:max-w-none outline-none">
                                <span className="truncate">
                                    {selectedField?.b_name ??
                                        "Kies een perceel"}
                                </span>
                                <ChevronDown className="text-muted-foreground h-4 w-4 shrink-0" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                                {fieldOptions.map((option) => (
                                    <DropdownMenuCheckboxItem
                                        checked={b_id === option.b_id}
                                        key={option.b_id}
                                    >
                                        <NavLink
                                            to={`/farm/${b_id_farm}/${calendar}/mineralization/${option.b_id}`}
                                        >
                                            {option.b_name}
                                        </NavLink>
                                    </DropdownMenuCheckboxItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </BreadcrumbItem>
                </>
            )}

            {isDyna ? (
                <>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbLink
                            href={`/farm/${b_id_farm}/${calendar}/mineralization/${b_id}/dyna`}
                        >
                            DYNA
                        </BreadcrumbLink>
                    </BreadcrumbItem>
                </>
            ) : (
                b_id && (
                    <>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                            <BreadcrumbLink
                                href={`/farm/${b_id_farm}/${calendar}/mineralization/${b_id}`}
                            >
                                Bodem N-levering
                            </BreadcrumbLink>
                        </BreadcrumbItem>
                    </>
                )
            )}
        </>
    )
}
