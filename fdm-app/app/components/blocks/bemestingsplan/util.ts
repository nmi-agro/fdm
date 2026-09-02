import { FoundFertilizerPlan } from "@nmi-agro/fdm-core"
import { formatDate } from "date-fns"
import { nl } from "date-fns/locale"
import { sanitizeForFilename } from "~/lib/download-utils"

export function getBemestingsplanDownloadName(
  b_id_farm: string,
  b_name_farm: string | null,
  plan: FoundFertilizerPlan,
) {
  const farmNameLabel = b_name_farm ?? b_id_farm
  const yearLabel = String(plan.p_plan_year)

  const parts = ["Bemestingsplan", farmNameLabel, yearLabel]
    .map(sanitizeForFilename)
    .filter((part) => part.length > 0)

  return `${parts.length > 0 ? parts.join("_") : "bemestingsplan"}.pdf`
}

/**
 * Human-readable title for a soil analysis, e.g. "Eurofins - 12 mrt. 2024",
 * used as the PDF viewer dialog title instead of the raw filename.
 */
export function getBemestingsplanTitle(plan: FoundFertilizerPlan): string {
  const dateLabel = plan.p_plan_date
    ? formatDate(plan.p_plan_date, "PP", { locale: nl })
    : "Datum onbekend"
  return `Bemestingsplan teeltjaar ${plan.p_plan_year} - opgesteld op ${dateLabel}`
}
