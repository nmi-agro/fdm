import type { ReactNode } from "react"
import { ChevronDown, ChevronRight, FileUp } from "lucide-react"
import { NavLink, useLocation } from "react-router"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible"

/** The forms for entering a soil analysis by hand. */
const MANUAL_FORMS = [
  {
    type: "standard",
    title: "Standaard bodemanalyse",
    description: "Stikstof, fosfaat, kalium, organische stof, zuurgraad en textuur.",
  },
  {
    type: "nmin",
    title: "Nmin-bemonstering",
    description: "Minerale stikstof (nitraat en ammonium) in een bemonsterde laag.",
  },
  {
    type: "derogation",
    title: "Analyse voor derogatie",
    description: "De parameters die nodig zijn voor derogatie.",
  },
] as const

/**
 * The ways to enter a soil analysis by hand, as a list of links to the forms. The form with every
 * soil parameter is behind "Meer opties".
 *
 * @param uploadHref - When given, a link to add the analysis from a PDF is shown first. Leave it
 * out on pages that already show the upload.
 */
export function SoilAnalysisFormSelection({ uploadHref }: { uploadHref?: string } = {}) {
  const location = useLocation()

  return (
    <div className="space-y-3">
      <ul className="divide-y overflow-hidden rounded-lg border">
        {uploadHref && (
          <li>
            <SelectionLink
              to={`${uploadHref}${location.search}`}
              title="PDF-rapport van het lab uploaden"
              description="De waarden worden uitgelezen; je controleert ze voordat je opslaat."
              icon={<FileUp aria-hidden className="text-muted-foreground size-4" />}
            />
          </li>
        )}
        {MANUAL_FORMS.map((manualForm) => (
          <li key={manualForm.type}>
            <SelectionLink
              to={`./${manualForm.type}${location.search}`}
              title={manualForm.title}
              description={manualForm.description}
            />
          </li>
        ))}
      </ul>
      <Collapsible>
        <CollapsibleTrigger className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 group flex items-center gap-1 rounded-sm text-sm font-medium focus-visible:ring-[3px] focus-visible:outline-none">
          <ChevronDown
            aria-hidden
            className="size-4 transition-transform group-data-[state=closed]:-rotate-90"
          />
          Meer opties
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          <ul className="overflow-hidden rounded-lg border">
            <li>
              <SelectionLink
                to={`./all${location.search}`}
                title="Alle bodemparameters"
                description="Voor analyses met parameters die niet in de andere formulieren staan."
              />
            </li>
          </ul>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

function SelectionLink({
  to,
  title,
  description,
  icon,
}: {
  to: string
  title: string
  description: string
  icon?: ReactNode
}) {
  return (
    <NavLink
      to={to}
      className="hover:bg-muted/50 focus-visible:ring-ring flex items-center gap-3 px-4 py-3 transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
    >
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="text-muted-foreground block text-sm">{description}</span>
      </span>
      <ChevronRight aria-hidden className="text-muted-foreground size-4 shrink-0" />
    </NavLink>
  )
}
