import { RefreshCw } from "lucide-react"
import { Alert, AlertDescription } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"

/**
 * A dismiss-free banner shown once background recomputation of stale/missing calculation cache
 * entries has finished. Clicking the button revalidates the current route's loader (no full page
 * reload) so the page picks up the fresh results. Fresh data is never swapped in silently.
 */
export function CalculationRefreshBanner({ onRefresh }: { onRefresh: () => void }) {
  return (
    <Alert className="flex items-center justify-between gap-4 border-primary/30 bg-primary/5">
      <AlertDescription className="text-foreground">
        Nieuwe resultaten zijn beschikbaar.
      </AlertDescription>
      <Button size="sm" variant="outline" onClick={onRefresh}>
        <RefreshCw className="mr-2 h-3.5 w-3.5" />
        Bijwerken
      </Button>
    </Alert>
  )
}
