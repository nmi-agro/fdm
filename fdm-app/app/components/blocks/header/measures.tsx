import { Link, useLocation, useMatches, useParams } from "react-router"
import { useCalendarStore } from "@/app/store/calendar"
import { HeaderFieldPicker } from "~/components/blocks/header/field-picker"
import {
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb"

export function HeaderMeasures({ b_id_farm }: { b_id_farm: string }) {
  const calendarFromStore = useCalendarStore((state) => state.calendar)
  const { calendar: calendarFromRoute, b_id, m_id } = useParams()
  const calendar = calendarFromRoute ?? calendarFromStore
  const matches = useMatches()
  const { pathname } = useLocation()

  const isFieldDetail = !!b_id

  // Read field name + field list from the field detail loader
  const fieldMatch = matches.find((m) => m.id === "routes/farm.$b_id_farm.$calendar.measures.$b_id")
  const fieldData = fieldMatch?.loaderData as
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

  // Measures catalogue: the catalogue and, on a detail page, the name of the measure
  const cataloguePath = `${basePath}/catalogue`
  const isCatalogue = pathname.startsWith(cataloguePath)
  const measureMatch = matches.find(
    (m) => m.id === "routes/farm.$b_id_farm.$calendar.measures.catalogue.$m_id",
  )
  const measureName =
    (measureMatch?.loaderData as { measure?: { m_name?: string } } | undefined)?.measure?.m_name ??
    m_id

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
      ) : null}

      {isCatalogue ? (
        <>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            {m_id ? (
              <BreadcrumbLink asChild>
                <Link to={cataloguePath}>Catalogus</Link>
              </BreadcrumbLink>
            ) : (
              <BreadcrumbPage>Catalogus</BreadcrumbPage>
            )}
          </BreadcrumbItem>
          {m_id ? (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage className="max-w-40 truncate sm:max-w-60 md:max-w-none">
                  {measureName}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </>
          ) : null}
        </>
      ) : null}
    </>
  )
}
