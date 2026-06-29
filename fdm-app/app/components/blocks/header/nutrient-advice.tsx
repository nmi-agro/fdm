import { ChevronDown } from "lucide-react"
import { NavLink } from "react-router"
import { useCalendarStore } from "@/app/store/calendar"
import { BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator } from "~/components/ui/breadcrumb"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"

export function HeaderNutrientAdvice({
  b_id_farm,
  b_id,
  fieldOptions,
}: {
  b_id_farm: string
  b_id: string | undefined
  fieldOptions: HeaderFieldOption[]
}) {
  const calendar = useCalendarStore((state) => state.calendar)

  return (
    <>
      <BreadcrumbSeparator className="hidden xl:block" />
      <BreadcrumbItem className="hidden xl:block">
        <BreadcrumbLink href={`/farm/${b_id_farm}/${calendar}/nutrient_advice`}>
          Bemestingsadvies
        </BreadcrumbLink>
      </BreadcrumbItem>
      {b_id ? (
        <>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <DropdownMenu>
              <DropdownMenuTrigger className="focus-visible:ring-ring flex max-w-30 items-center gap-1 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 sm:max-w-50 md:max-w-none">
                <span className="truncate">
                  {fieldOptions
                    ? (fieldOptions.find((option) => option.b_id === b_id)?.b_name ??
                      "Unknown field")
                    : "Kies een perceel"}
                </span>
                <ChevronDown className="text-muted-foreground h-4 w-4 shrink-0" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {fieldOptions.map((option) => (
                  <DropdownMenuCheckboxItem checked={b_id === option.b_id} key={option.b_id}>
                    <NavLink to={`/farm/${b_id_farm}/${calendar}/nutrient_advice/${option.b_id}`}>
                      {option.b_name}
                    </NavLink>
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
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
