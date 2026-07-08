import { ChevronDown } from "lucide-react"
import { NavLink, useLocation } from "react-router"
import { useCalendarStore } from "@/app/store/calendar"
import { BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator } from "~/components/ui/breadcrumb"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { HeaderFieldPicker } from "~/components/blocks/header/field-picker"

export function HeaderBalance({
  b_id_farm,
  b_id,
  fieldOptions,
}: {
  b_id_farm: string
  b_id: string | undefined
  fieldOptions: HeaderFieldOption[]
}) {
  const location = useLocation()
  const currentPath = String(location.pathname)
  const calendar = useCalendarStore((state) => state.calendar)
  const balanceKind = currentPath.includes("/balance/nitrogen") ? "nitrogen" : "organic-matter"

  return (
    <>
      <BreadcrumbSeparator className="hidden xl:block" />
      <BreadcrumbItem className="hidden xl:block">
        <BreadcrumbLink href={`/farm/${b_id_farm}/${calendar}/balance`}>Balans</BreadcrumbLink>
      </BreadcrumbItem>
      <BreadcrumbSeparator />
      <BreadcrumbItem>
        <DropdownMenu>
          <DropdownMenuTrigger className="flex max-w-[120px] items-center gap-1 outline-none sm:max-w-[200px] md:max-w-none">
            <span className="truncate">
              {currentPath.includes("/balance/nitrogen") ? "Stikstof" : "Organische stof"}
            </span>
            <ChevronDown className="text-muted-foreground h-4 w-4 shrink-0" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuCheckboxItem
              checked={currentPath.includes("/balance/nitrogen")}
              key={"nitrogen"}
            >
              <NavLink to={`/farm/${b_id_farm}/${calendar}/balance/nitrogen`}>Stikstof</NavLink>
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={currentPath.includes("/balance/organic-matter")}
              key={"organic-matter"}
            >
              <NavLink to={`/farm/${b_id_farm}/${calendar}/balance/organic-matter`}>
                Organische stof
              </NavLink>
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </BreadcrumbItem>
      {b_id ? (
        <>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <HeaderFieldPicker
              b_id={b_id}
              fieldOptions={fieldOptions}
              buildHref={(optionId) => `/farm/${b_id_farm}/${calendar}/balance/${balanceKind}/${optionId}`}
            />
          </BreadcrumbItem>
        </>
      ) : null}
    </>
  )
}

type HeaderFieldOption = {
  b_id: string
  b_name: string | undefined | null
}
