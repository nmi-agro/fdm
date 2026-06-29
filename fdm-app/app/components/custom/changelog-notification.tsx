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
    <div className="border-muted-foreground/20 bg-background hover:border-primary flex items-center justify-between gap-2 rounded-md border p-2 text-sm shadow-sm transition-colors">
      <NavLink to="/about/whats-new" className="flex grow items-center gap-2">
        <Circle className="h-4 w-4 fill-blue-400 text-blue-400" />
        <span className="text-shadow-muted-foregroundforeground font-medium">
          {latestUpdateTitle}
        </span>
        <ArrowRight className="h-4 w-4" />
      </NavLink>
      <Button
        variant="ghost"
        size="icon"
        onClick={markAllAsSeen}
        className="text-muted-foreground hover:bg-muted-foreground/20 h-6 w-6"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}
