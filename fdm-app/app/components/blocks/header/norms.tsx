import { useCalendarStore } from "@/app/store/calendar"
import { HeaderFieldPicker } from "~/components/blocks/header/field-picker"
import { BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator } from "~/components/ui/breadcrumb"

export function HeaderNorms({
  b_id_farm,
  b_id,
  fieldOptions,
}: {
  b_id_farm: string
  b_id?: string | undefined
  fieldOptions?: HeaderFieldOption[]
}) {
  const calendar = useCalendarStore((state) => state.calendar)

  return (
    <>
      <BreadcrumbSeparator className="hidden xl:block" />
      <BreadcrumbItem className="hidden xl:block">
        <BreadcrumbLink href={`/farm/${b_id_farm}/${calendar}/norms`}>
          Gebruiksruimte
        </BreadcrumbLink>
      </BreadcrumbItem>
      {b_id && fieldOptions ? (
        <>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <HeaderFieldPicker
              b_id={b_id}
              fieldOptions={fieldOptions}
              buildHref={(optionId) => `/farm/${b_id_farm}/${calendar}/norms/${optionId}`}
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
