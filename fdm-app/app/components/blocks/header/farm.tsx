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

export function getSafeFarmPath(currentPath: string, newFarmId: string) {
    const segments = currentPath.split("/").filter(Boolean)
    if (segments[0] !== "farm" || segments.length < 2) {
        return `/farm/${newFarmId}`
    }

    // Replace the farm ID (which is at index 1)
    segments[1] = newFarmId

    // Check if there's a calendar year at index 2
    const hasCalendar = /^\d{4}$/.test(segments[2] || "")

    // The module is either at index 3 (if calendar) or index 2 (if no calendar)
    const moduleIndex = hasCalendar ? 3 : 2

    // Check if the module has safe submodules we want to preserve
    let keepIndex = moduleIndex
    const subModuleDirs = ["balance", "atlas", "rotation_", "settings"]
    if (
        segments.length > moduleIndex + 1 &&
        subModuleDirs.includes(segments[moduleIndex])
    ) {
        keepIndex = moduleIndex + 1
    }

    // If we have segments beyond the safe keepIndex, truncate them
    if (segments.length > keepIndex + 1) {
        return "/" + segments.slice(0, keepIndex + 1).join("/")
    }

    // Otherwise return the path as is (with the farm ID replaced)
    return "/" + segments.join("/")
}

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
                                                ? getSafeFarmPath(
                                                      currentPath,
                                                      option.b_id_farm,
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
