import { Info } from "lucide-react"
import { Button } from "~/components/ui/button"
import { getHarvestTerm } from "./utils"

export function HarvestModeSwitchAlert({
  isBatchMode,
  b_lu_croprotation,
  onSwitch,
}: {
  isBatchMode: boolean
  b_lu_croprotation?: string | null
  onSwitch: React.MouseEventHandler<HTMLButtonElement>
}) {
  return (
    <div className="bg-muted/40 flex flex-row items-center justify-between rounded-lg border p-4">
      <div className="text-muted-foreground flex items-center gap-3 text-sm">
        <Info className="text-primary h-4 w-4 shrink-0" />
        <p>
          {isBatchMode
            ? `Wilt u liever een enkele ${getHarvestTerm(b_lu_croprotation)} toevoegen of bijwerken?`
            : `Voor dit gewas is het mogelijk om meerdere ${getHarvestTerm(b_lu_croprotation, true)} tegelijk toe te voegen.`}
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onSwitch}
        className="ml-4 shrink-0"
      >
        Overschakelen
      </Button>
    </div>
  )
}
