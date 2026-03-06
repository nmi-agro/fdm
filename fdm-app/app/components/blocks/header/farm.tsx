import { ChevronDown } from "lucide-react"
import { NavLink, useLocation } from "react-router"
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

export function HeaderFarm({
    b_id_farm,
    farmOptions,
}: {
    b_id_farm: string | undefined
    farmOptions: HeaderFarmOption[]
}) {
    const location = useLocation()
    const currentPath = String(location.pathname)

    return (
        <>
            <BreadcrumbItem className="hidden xl:block">
                {b_id_farm ? (
                    <BreadcrumbLink href={`/farm/${b_id_farm}`}>
                        Bedrijf
                    </BreadcrumbLink>
                ) : (
                    "Bedrijf"
                )}
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden xl:block" />
            <BreadcrumbItem>
                <DropdownMenu>
                    <DropdownMenuTrigger className="flex items-center gap-1 max-w-30 sm:max-w-50 md:max-w-none outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                        <span className="truncate">
                            {b_id_farm && farmOptions
                                ? (farmOptions.find(
                                      (option) =>
                                          option.b_id_farm === b_id_farm,
                                  )?.b_name_farm ?? "Geen bedrijf geselecteerd")
                                : "Kies een bedrijf"}
                        </span>
                        {farmOptions && farmOptions.length > 0 ? (
                            <ChevronDown className="text-muted-foreground h-4 w-4 shrink-0" />
                        ) : null}
                    </DropdownMenuTrigger>
                    {farmOptions && farmOptions.length > 0 ? (
                        <DropdownMenuContent align="start">
                            {farmOptions.map((option) => (
                                <DropdownMenuCheckboxItem
                                    checked={b_id_farm === option.b_id_farm}
                                    key={option.b_id_farm}
                                >
                                    <NavLink
                                        to={
                                            b_id_farm
                                                ? currentPath.replace(
                                                      /^\/farm\/[^/]+/,
                                                      `/farm/${option.b_id_farm}`,
                                                  )
                                                : `/farm/${option.b_id_farm}`
                                        }
                                    >
                                        {option.b_name_farm ?? "Naam onbekend"}
                                    </NavLink>
                                </DropdownMenuCheckboxItem>
                            ))}
                        </DropdownMenuContent>
                    ) : null}
                </DropdownMenu>
            </BreadcrumbItem>
        </>
    )
}

type HeaderFarmOption = {
    b_id_farm: string
    b_name_farm: string | undefined | null
}
