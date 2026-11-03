import { X } from "lucide-react"
import { Link } from "react-router"
import { SidebarMenuItem } from "~/components/ui/sidebar"
import { changelogReleases } from "~/lib/changelog"
import { clientConfig } from "~/lib/config"
import { useChangelogStore } from "~/store/changelog"

/**
 * Sidebar notice for a release the user has not seen yet. It shows the title of the newest
 * release, links to the changelog page and can be closed until the next release.
 *
 * Must be rendered inside a `SidebarMenu`.
 */
export function ChangelogNotification() {
  const hasNewUpdates = useChangelogStore((state) => state.hasNewUpdates)
  const dismissNotification = useChangelogStore((state) => state.dismissNotification)

  const latestRelease = changelogReleases[0]
  if (!hasNewUpdates || !latestRelease) {
    return null
  }

  const heading = `Nieuw in ${clientConfig.name}`

  return (
    <SidebarMenuItem className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 mb-2 duration-300 ease-out">
      <Link
        to="/about/whats-new"
        className="bg-background border-border hover:bg-sidebar-accent focus-visible:ring-sidebar-ring flex gap-2.5 rounded-md border py-2.5 pr-10 pl-3 transition-colors outline-none focus-visible:ring-2"
      >
        <span aria-hidden="true" className="bg-primary mt-1.5 size-2 shrink-0 rounded-full" />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-foreground text-sm leading-5 font-semibold">{heading}</span>
          <span className="text-muted-foreground line-clamp-2 text-xs leading-4">
            {latestRelease.title}
          </span>
        </span>
      </Link>
      <button
        type="button"
        onClick={dismissNotification}
        aria-label="Melding over nieuwe versie sluiten"
        className="text-muted-foreground hover:text-foreground hover:bg-sidebar-accent focus-visible:ring-sidebar-ring absolute top-1 right-1 flex size-8 items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-2"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </SidebarMenuItem>
  )
}
