import { ExternalLink, Info } from "lucide-react"
import { Link, useParams } from "react-router"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip"
import { getMeasureCataloguePath } from "~/lib/measures-catalogue"
import { cn } from "~/lib/utils"

export { getMeasureCataloguePath }

/**
 * Icon link that opens the detail page of a measure in a new tab, so the user keeps the
 * current page (for example an open dialog or a filled-in form). On a farm page the farm and
 * calendar year are passed along, so the detail page shows where the measure is applied.
 *
 * @param props.m_id - Catalogue ID of the measure.
 * @param props.m_name - Name of the measure, used in the accessible label.
 * @param props.icon - `info` for an info icon (lists where the row itself is clickable),
 *   `external` for an external-link icon next to a measure name.
 */
export function MeasureDetailLink({
  m_id,
  m_name,
  icon = "info",
  className,
}: {
  m_id: string
  m_name: string
  icon?: "info" | "external"
  className?: string
}) {
  const { b_id_farm, calendar } = useParams()
  const Icon = icon === "info" ? Info : ExternalLink
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            to={getMeasureCataloguePath(m_id, { b_id_farm, calendar })}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open details voor ${m_name} in nieuw tabblad`}
            onClick={(event) => event.stopPropagation()}
            className={cn(
              "text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex shrink-0 items-center justify-center rounded-sm p-1 focus-visible:ring-2 focus-visible:outline-none",
              className,
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </TooltipTrigger>
        <TooltipContent side="top">Details in nieuw tabblad</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
