import { Info } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip"

/**
 * Small "i" affordance that explains what farm verification means and how to
 * get it. Use this next to every "Geverifieerd" / "niet geverifieerd" label so
 * the same explanation is one hover away everywhere, instead of each screen
 * writing its own partial version.
 */
export function FarmVerificationInfo({ className }: { className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className={className} aria-label="Wat betekent geverifieerd?">
          <Info className="text-muted-foreground h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-70">
        Een bedrijf wordt geverifieerd zodra u met eHerkenning bij RVO een succesvolle opvraag doet
        en het KvK-nummer daarvan overeenkomt met het KvK-nummer van dit bedrijf.
      </TooltipContent>
    </Tooltip>
  )
}
