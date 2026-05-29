import { ChevronDown } from "lucide-react"
import { NavLink, useMatches, useParams } from "react-router"
import { useCalendarStore } from "@/app/store/calendar"
import {
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "~/components/ui/breadcrumb"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"

export function HeaderMeasures({ b_id_farm }: { b_id_farm: string }) {
    const calendarFromStore = useCalendarStore((state) => state.calendar)
    const { calendar: calendarFromRoute, b_id } = useParams()
    const calendar = calendarFromRoute ?? calendarFromStore
    const matches = useMatches()

    const isFieldDetail = !!b_id

    // Read field name + field list from the field detail loader
    const fieldMatch = matches.find(
        (m) => m.id === "routes/farm.$b_id_farm.$calendar.measures.$b_id",
    )
    const fieldData = fieldMatch?.data as
        | {
              field?: { b_name?: string | null }
              fieldList?: Array<{ b_id: string; b_name: string | null }>
          }
        | undefined
    const fieldName: string | null = fieldData?.field?.b_name ?? null
    const fieldList = fieldData?.fieldList ?? []

    const basePath = calendar
        ? `/farm/${b_id_farm}/${calendar}/measures`
        : `/farm/${b_id_farm}/measures`

    return (
        <>
            <BreadcrumbSeparator className="hidden xl:block" />
            <BreadcrumbItem className="hidden xl:block">
                <BreadcrumbLink href={basePath}>Maatregelen</BreadcrumbLink>
            </BreadcrumbItem>

            {isFieldDetail ? (
                <>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        {fieldList.length > 1 ? (
                            <DropdownMenu>
                                <DropdownMenuTrigger className="flex items-center gap-1 max-w-30 sm:max-w-50 md:max-w-none outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                                    <span className="truncate">
                                        {fieldName ?? b_id}
                                    </span>
                                    <ChevronDown className="h-4 w-4 shrink-0" />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    align="start"
                                    className="max-h-72 overflow-y-auto"
                                >
                                    {fieldList.map((f) => (
                                        <DropdownMenuItem
                                            key={f.b_id}
                                            asChild
                                            className={
                                                f.b_id === b_id
                                                    ? "font-semibold"
                                                    : ""
                                            }
                                        >
                                            <NavLink
                                                to={`${basePath}/${f.b_id}`}
                                            >
                                                {f.b_name ?? f.b_id}
                                            </NavLink>
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        ) : (
                            <BreadcrumbPage className="max-w-30 sm:max-w-50 md:max-w-none truncate">
                                {fieldName ?? b_id}
                            </BreadcrumbPage>
                        )}
                    </BreadcrumbItem>
                </>
            ) : null}
        </>
    )
}
