import { Link, useLocation } from "react-router"
import {
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb"

/**
 * Breadcrumbs for the measures catalogue: the catalogue itself and, on a detail page,
 * the measure that is shown. The link back to the catalogue keeps the selected farm and year.
 */
export function HeaderMeasuresCatalogue({ measureName }: { measureName?: string }) {
  const { search } = useLocation()
  return (
    <>
      <BreadcrumbItem className={measureName ? "hidden xl:block" : undefined}>
        <BreadcrumbLink asChild>
          <Link to={`/measures-catalogue${search}`}>Maatregelencatalogus</Link>
        </BreadcrumbLink>
      </BreadcrumbItem>
      {measureName ? (
        <>
          <BreadcrumbSeparator className="hidden xl:block" />
          <BreadcrumbItem>
            <BreadcrumbPage className="max-w-50 truncate sm:max-w-80 md:max-w-none">
              {measureName}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </>
      ) : null}
    </>
  )
}
