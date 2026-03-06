import { PanelsRightBottom } from "lucide-react"
import { Button } from "~/components/ui/button"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "~/components/ui/tooltip"

export function BufferStripInfo() {
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant="outline"
                        size="icon"
                        className="border cursor-default hover:bg-background"
                        aria-label="Bufferstroken info"
                    >
                        <PanelsRightBottom className="h-4 w-4 text-muted-foreground" />
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>
                        Bufferstroken zijn uitgesloten van de balansberekening
                    </p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}
