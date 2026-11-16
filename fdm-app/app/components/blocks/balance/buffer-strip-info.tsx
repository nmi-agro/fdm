import { PanelsRightBottom } from "lucide-react"
import { Button } from "~/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip"

export function BufferStripInfo() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="outline"
              size="icon"
              className="hover:bg-background cursor-default border"
              aria-label="Bufferstroken info"
            >
              <PanelsRightBottom className="text-muted-foreground h-4 w-4" />
            </Button>
          }
        />
        <TooltipContent>
          <p>Bufferstroken zijn uitgesloten van de balansberekening</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
