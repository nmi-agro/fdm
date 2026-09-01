import { AnimatePresence } from "framer-motion"
import { RefreshCw } from "lucide-react"
import { useState } from "react"
import { Alert, AlertDescription } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { Spinner } from "~/components/ui/spinner"

/**
 * A dismiss-free banner shown once background recomputation of stale/missing calculation cache
 * entries has finished. Clicking the button revalidates the current route's loader (no full page
 * reload) so the page picks up the fresh results. Fresh data is never swapped in silently.
 */
export function CalculationRefreshBanner({ onRefresh }: { onRefresh: () => void }) {
  const [refreshing, setRefreshing] = useState(false)
  return (
    <AnimatePresence>
      <Alert className="bg-card fixed right-4 bottom-4 z-30 max-w-60 items-center justify-between gap-4 shadow-sm">
        <AlertDescription className="text-foreground">
          Nieuwe resultaten zijn beschikbaar.
        </AlertDescription>
        <Button
          size="sm"
          variant="outline"
          className="ml-auto flex"
          onClick={() => {
            setRefreshing(true)
            onRefresh()
          }}
        >
          <RefreshCw className="mr-2 h-3.5 w-3.5" />
          Bijwerken
          {refreshing && <Spinner />}
        </Button>
      </Alert>
    </AnimatePresence>
  )
}
