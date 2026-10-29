import { format, parseISO } from "date-fns"
import { nl } from "date-fns/locale"
import { ChevronDown, Info } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "~/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible"
import {
  type ChangelogItem,
  type ChangelogRelease,
  compareVersions,
  getReleaseAnchorId,
} from "~/lib/changelog"
import { cn } from "~/lib/utils"
import { useChangelogStore } from "~/store/changelog"

function formatReleaseDate(date: string): string {
  return format(parseISO(date), "d MMMM yyyy", { locale: nl })
}

function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`
}

/**
 * Lists all releases newest first. Releases that are new since the previous visit, and always
 * the latest release, are expanded; older releases are collapsed.
 *
 * Opening this component marks all releases as seen.
 */
export function Changelog({ title, releases }: { title: string; releases: ChangelogRelease[] }) {
  const versionSeenBeforeVisit = useChangelogStore((state) => state.versionSeenBeforeVisit)
  const openChangelog = useChangelogStore((state) => state.openChangelog)
  const [openReleases, setOpenReleases] = useState<Record<string, boolean>>({})

  useEffect(() => {
    openChangelog()
  }, [openChangelog])

  const isNew = (release: ChangelogRelease) =>
    typeof versionSeenBeforeVisit === "string" &&
    compareVersions(release.version, versionSeenBeforeVisit) > 0
  const newCount = releases.filter(isNew).length
  const firstOlderIndex = newCount > 0 ? releases.findIndex((release) => !isNew(release)) : -1

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 md:px-6 md:py-10">
      <header className="border-b pb-6">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="text-muted-foreground mt-2">
          Een overzicht van alle wijzigingen per versie, met de nieuwste bovenaan.
        </p>
        {newCount > 0 && typeof versionSeenBeforeVisit === "string" ? (
          <p className="mt-4 text-sm">
            <span className="font-medium">
              {pluralize(newCount, "nieuwe versie", "nieuwe versies")}
            </span>{" "}
            sinds uw laatste bezoek ({versionSeenBeforeVisit}).
          </p>
        ) : null}
      </header>

      {releases.map((release, index) => (
        <div key={release.version} className={cn(index > 0 && "border-t")}>
          {index === firstOlderIndex ? (
            <p className="text-muted-foreground pt-6 text-sm font-medium">Eerdere versies</p>
          ) : null}
          <ReleaseSection
            release={release}
            isOpen={openReleases[release.version] ?? (index === 0 || isNew(release))}
            onOpenChange={(open) =>
              setOpenReleases((current) => ({ ...current, [release.version]: open }))
            }
          />
        </div>
      ))}
    </div>
  )
}

function ReleaseSection({
  release,
  isOpen,
  onOpenChange,
}: {
  release: ChangelogRelease
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}) {
  const anchorId = getReleaseAnchorId(release.version)
  const titleId = `${anchorId}-title`
  const contentId = `${anchorId}-content`

  return (
    <section
      id={anchorId}
      aria-labelledby={titleId}
      className="scroll-mt-6 py-8 lg:grid lg:grid-cols-[9rem_minmax(0,1fr)] lg:gap-x-10"
    >
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm lg:sticky lg:top-6 lg:mb-0 lg:flex-col lg:items-start lg:self-start">
        <a
          href={`#${anchorId}`}
          className="font-medium tabular-nums underline-offset-4 hover:underline"
          aria-label={`Link naar versie ${release.version}`}
        >
          {release.version}
        </a>
        <time dateTime={release.date} className="text-muted-foreground">
          {formatReleaseDate(release.date)}
        </time>
      </div>

      <Collapsible open={isOpen} onOpenChange={onOpenChange} className="max-w-prose min-w-0">
        <h2
          id={titleId}
          className="text-lg leading-snug font-semibold tracking-tight text-balance md:text-xl"
        >
          {release.title}
        </h2>
        <CollapsibleTrigger
          render={
            <Button
              variant="link"
              size="sm"
              className="text-muted-foreground hover:text-foreground mt-1 h-auto px-0 py-1"
              aria-controls={contentId}
            >
              {isOpen
                ? "Verberg wijzigingen"
                : `Toon ${pluralize(release.items.length, "wijziging", "wijzigingen")}`}
              <ChevronDown
                aria-hidden="true"
                className={cn("transition-transform", isOpen && "rotate-180")}
              />
            </Button>
          }
        />
        <CollapsibleContent id={contentId}>
          <p className="mt-3 leading-7 text-pretty">{release.description}</p>
          <ul className="mt-6 space-y-6">
            {release.items.map((item) => (
              <ChangelogListItem key={item.title} item={item} />
            ))}
          </ul>
        </CollapsibleContent>
      </Collapsible>
    </section>
  )
}

function ChangelogListItem({ item }: { item: ChangelogItem }) {
  return (
    <li>
      <h3 className="text-sm leading-6 font-semibold">{item.title}</h3>
      {item.body ? <p className="mt-1 text-sm leading-6 text-pretty">{item.body}</p> : null}
      {item.correction ? (
        <p className="bg-muted mt-3 flex gap-2 rounded-md px-3 py-2 text-sm leading-6">
          <Info aria-hidden="true" className="mt-1 size-4 shrink-0" />
          <span>
            <span className="font-medium">
              Gecorrigeerd in{" "}
              <a
                href={`#${getReleaseAnchorId(item.correction.version)}`}
                className="underline underline-offset-4"
              >
                {item.correction.version}
              </a>
              :
            </span>{" "}
            {item.correction.text}
          </span>
        </p>
      ) : null}
    </li>
  )
}
