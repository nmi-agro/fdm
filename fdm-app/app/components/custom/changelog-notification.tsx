import { ArrowRight, Circle, X } from "lucide-react"
import { NavLink } from "react-router"
import { Button } from "~/components/ui/button"
import { useChangelogStore } from "~/store/changelog"

export function ChangelogNotification() {
  const { hasNewUpdates, latestUpdateTitle, markAllAsSeen } = useChangelogStore()

  if (!hasNewUpdates || !latestUpdateTitle) {
    return null
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-muted-foreground/20 bg-background p-2 text-sm shadow-sm transition-colors hover:border-primary">
      <NavLink to="/about/whats-new" className="flex grow items-center gap-2">
        <Circle className="h-4 w-4 text-blue-400 fill-blue-400" />
        <span className="font-medium text-shadow-muted-foregroundforeground">
          {latestUpdateTitle}
        </span>
        <ArrowRight className="h-4 w-4" />
      </NavLink>
      <Button
        variant="ghost"
        size="icon"
        onClick={markAllAsSeen}
        className="h-6 w-6 text-muted-foreground hover:bg-muted-foreground/20"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}
