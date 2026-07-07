import { useMatches, useParams } from "react-router"
import { useCalendarStore } from "@/app/store/calendar"
import {
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb"
import { HeaderFieldPicker } from "~/components/blocks/header/field-picker"

export function HeaderIndicators({ b_id_farm }: { b_id_farm: string }) {
  const calendarFromStore = useCalendarStore((state) => state.calendar)
  const { calendar: calendarFromRoute, b_id } = useParams()
  const calendar = calendarFromRoute ?? calendarFromStore
  const matches = useMatches()

  const isFieldDetail = !!b_id

  // Read field name + field list from the field detail loader
  const fieldMatch = matches.find((m) => m.id.includes("indicators.$b_id"))
  const fieldData = fieldMatch?.loaderData as
    | {
        field?: { b_name?: string | null }
        fieldList?: Array<{ b_id: string; b_name: string | null }>
      }
    | undefined
  const fieldName: string | null = fieldData?.field?.b_name ?? null
  const fieldList = fieldData?.fieldList ?? []

  const basePath = `/farm/${b_id_farm}/${calendar}/indicators`

  return (
    <>
      <BreadcrumbSeparator className="hidden xl:block" />
      <BreadcrumbItem className="hidden xl:block">
        <BreadcrumbLink href={basePath}>Indicatoren</BreadcrumbLink>
      </BreadcrumbItem>

      {isFieldDetail && (
        <>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            {fieldList.length > 1 ? (
              <HeaderFieldPicker
                b_id={b_id}
                fieldOptions={fieldList}
                buildHref={(optionId) => `${basePath}/${optionId}`}
              />
            ) : (
              <BreadcrumbPage className="max-w-30 truncate sm:max-w-50 md:max-w-none">
                {fieldName ?? b_id}
              </BreadcrumbPage>
            )}
          </BreadcrumbItem>
        </>
      )}
    </>
  )
}
