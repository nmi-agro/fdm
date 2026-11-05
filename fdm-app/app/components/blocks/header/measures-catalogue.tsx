import {
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb"

/**
 * Breadcrumbs for the measures catalogue: the catalogue itself and, on a detail page,
 * the measure that is shown.
 */
export function HeaderMeasuresCatalogue({ measureName }: { measureName?: string }) {
  return (
    <>
      <BreadcrumbItem className={measureName ? "hidden xl:block" : undefined}>
        <BreadcrumbLink href="/measures-catalogue">Maatregelencatalogus</BreadcrumbLink>
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
