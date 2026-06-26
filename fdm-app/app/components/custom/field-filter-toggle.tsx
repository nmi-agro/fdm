import { PanelsRightBottom, Square } from "lucide-react"
import { Button } from "~/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip"
import { useFieldFilterStore } from "~/store/field-filter"

export function FieldFilterToggle() {
  const { showProductiveOnly, toggleShowProductiveOnly } = useFieldFilterStore()

  const tooltipContent = showProductiveOnly
    ? "Bufferstroken zijn verborgen"
    : "Alle percelen (incl. bufferstroken) zijn weergegeven"

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            onClick={toggleShowProductiveOnly}
            className="hover:bg-accent hover:text-accent-foreground border"
            aria-label={tooltipContent}
            aria-pressed={showProductiveOnly}
          >
            {showProductiveOnly ? (
              <Square className="text-primary h-4 w-4" />
            ) : (
              <PanelsRightBottom className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipContent}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
