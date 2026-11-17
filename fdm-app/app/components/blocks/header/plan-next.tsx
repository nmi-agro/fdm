import { useLocation, useParams } from "react-router"
import { getPlanNextPath, getPlanNextStepBySlug } from "~/components/blocks/plan-next/steps"
import {
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb"

/** Breadcrumbs of the season planning wizard: "Plan volgend seizoen" › year › step. */
export function HeaderPlanNext({ b_id_farm }: { b_id_farm: string }) {
  const { year } = useParams()
  const { pathname } = useLocation()
  const segments = pathname.split("/").filter(Boolean)
  const yearIndex = year ? segments.indexOf(year) : -1
  const step = yearIndex >= 0 ? getPlanNextStepBySlug(segments[yearIndex + 1]) : undefined

  return (
    <>
      <BreadcrumbSeparator className="hidden xl:block" />
      <BreadcrumbItem className="hidden xl:block">
        <BreadcrumbLink href={getPlanNextPath(b_id_farm)}>Plan volgend seizoen</BreadcrumbLink>
      </BreadcrumbItem>
      {year ? (
        <>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            {step ? (
              <BreadcrumbLink href={getPlanNextPath(b_id_farm, year, "start")}>
                {year}
              </BreadcrumbLink>
            ) : (
              <BreadcrumbPage>{year}</BreadcrumbPage>
            )}
          </BreadcrumbItem>
        </>
      ) : null}
      {step ? (
        <>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{step.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </>
      ) : null}
    </>
  )
}
