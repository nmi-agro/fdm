import { useCalendarStore } from "@/app/store/calendar"
import { BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator } from "~/components/ui/breadcrumb"
import { HeaderFieldPicker } from "~/components/blocks/header/field-picker"

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
            <HeaderFieldPicker
              b_id={b_id}
              fieldOptions={fieldOptions}
              buildHref={(optionId) => `/farm/${b_id_farm}/${calendar}/nutrient_advice/${optionId}`}
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
