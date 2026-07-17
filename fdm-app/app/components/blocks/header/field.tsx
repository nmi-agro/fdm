import { useLocation } from "react-router"
import { cn } from "@/app/lib/utils"
import { useCalendarStore } from "@/app/store/calendar"
import { HeaderFieldPicker } from "~/components/blocks/header/field-picker"
import { BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator } from "~/components/ui/breadcrumb"

export function HeaderField({
  b_id_farm,
  b_id,
  fieldOptions,
  compact,
}: {
  b_id_farm: string
  b_id: string | undefined
  fieldOptions: HeaderFieldOption[]
  compact?: boolean
}) {
  const location = useLocation()
  const currentPath = String(location.pathname)
  const calendar = useCalendarStore((state) => state.calendar)

  const buildHref = (optionId: string) =>
    currentPath.includes("/cultivation")
      ? `/farm/${b_id_farm}/${calendar}/field/${optionId}/cultivation`
      : b_id
        ? currentPath.replace(`/field/${b_id}`, `/field/${optionId}`)
        : `/farm/${b_id_farm}/${calendar}/field/${optionId}`

  return (
    <>
      <BreadcrumbSeparator className="hidden xl:block" />
      <BreadcrumbItem className={cn("hidden", !compact && "xl:block")}>
        <BreadcrumbLink href={`/farm/${b_id_farm}/${calendar}/field`}>Perceel</BreadcrumbLink>
      </BreadcrumbItem>
      {fieldOptions.length > 0 ? (
        <>
          <BreadcrumbSeparator className={cn("hidden", !compact && "xl:block")} />
          <BreadcrumbItem>
            <HeaderFieldPicker b_id={b_id} fieldOptions={fieldOptions} buildHref={buildHref} />
          </BreadcrumbItem>
        </>
      ) : (
        <>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href={`/farm/${b_id_farm}/${calendar}/field/new`}>
              Nieuwe perceel
            </BreadcrumbLink>
          </BreadcrumbItem>
        </>
      )}
    </>
  )
}

type HeaderFieldOption = {
  b_id: string
  b_name: string | undefined | null
}
