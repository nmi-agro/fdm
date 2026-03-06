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
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"

export function HeaderAtlas({ b_id_farm }: { b_id_farm: string | undefined }) {
    const calendar = useCalendarStore((state) => state.calendar)
    const location = useLocation()

    const isElevation = location.pathname.includes("/elevation")
    const isSoil = location.pathname.includes("/soil")
    const currentName = isElevation
        ? "Hoogtekaart"
        : isSoil
          ? "Bodemkaart"
          : "Gewaspercelen"

    return (
        <>
            <BreadcrumbSeparator className="hidden xl:block" />
            <BreadcrumbItem className="hidden xl:block">
                <BreadcrumbLink href={`/farm/${b_id_farm}/${calendar}/atlas`}>
                    Atlas
                </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
                <DropdownMenu>
                    <DropdownMenuTrigger className="flex items-center gap-1 max-w-30 sm:max-w-50 md:max-w-none outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                        <span className="truncate">{currentName}</span>
                        <ChevronDown className="h-4 w-4 shrink-0" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                        <DropdownMenuItem asChild>
                            <NavLink
                                to={`/farm/${b_id_farm}/${calendar}/atlas/fields`}
                            >
                                Gewaspercelen
                            </NavLink>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                            <NavLink
                                to={`/farm/${b_id_farm}/${calendar}/atlas/elevation`}
                            >
                                Hoogtekaart
                            </NavLink>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                            <NavLink
                                to={`/farm/${b_id_farm}/${calendar}/atlas/soil`}
                            >
                                Bodemkaart
                            </NavLink>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </BreadcrumbItem>
        </>
    )
}

type HeaderAtlasLayerOption = {
    atlasLayerId: string
    atlasLayerName: string
}
