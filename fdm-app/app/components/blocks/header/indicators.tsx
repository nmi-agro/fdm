import { NavLink } from "react-router"
import {
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbSeparator,
} from "~/components/ui/breadcrumb"
import { useCalendarStore } from "~/store/calendar"

export function HeaderIndicators({
    b_id_farm,
}: {
    b_id_farm: string
}) {
    const calendar = useCalendarStore((state) => state.calendar)

    return (
        <>
            <BreadcrumbSeparator className="hidden xl:block" />
            <BreadcrumbItem className="hidden xl:block">
                <BreadcrumbLink
                    asChild
                >
                    <NavLink
                        to={`/farm/${b_id_farm}/${calendar}/indicators`}
                    >
                        Indicatoren
                    </NavLink>
                </BreadcrumbLink>
            </BreadcrumbItem>
        </>
    )
}
