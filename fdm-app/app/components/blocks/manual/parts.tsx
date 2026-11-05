import { ArrowLeft, ArrowRight, ChevronRight } from "lucide-react"
import { Link, useLocation } from "react-router"
import type { ManualHeading } from "~/lib/manual/parse"
import type { ManualNavItem } from "~/lib/manual/types"
import { Button } from "~/components/ui/button"
import { useAnalytics } from "~/hooks/use-analytics"
import { clientConfig } from "~/lib/config"
import { MANUAL_EVENTS } from "~/lib/manual/analytics"
import { cn } from "~/lib/utils"
import { UiLabel } from "./article"

/** The labels a reader clicks to reach the described page in the app. */
export function ManualInAppPath({ labels }: { labels: string[] }) {
  return (
    <div className="bg-muted/40 border-border mt-6 rounded-lg border px-4 py-3">
      <p className="text-muted-foreground mb-2 text-sm font-medium">Zo vind je het in de app</p>
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-2 text-sm">
        {labels.map((label, index) => (
          <li key={label} className="flex items-center gap-1.5">
            {index > 0 ? (
              <ChevronRight className="text-muted-foreground size-3.5" aria-hidden />
            ) : null}
            <UiLabel className="py-0.5">{label}</UiLabel>
          </li>
        ))}
      </ol>
    </div>
  )
}

/** "Op deze pagina": links to the h2 and h3 headings of the article. */
export function ManualToc({
  headings,
  className,
}: {
  headings: ManualHeading[]
  className?: string
}) {
  const items = headings.filter((h) => h.depth === 2 || h.depth === 3)
  if (items.length === 0) return null
  return (
    <nav aria-label="Op deze pagina" className={className}>
      <p className="text-foreground mb-2 text-sm font-semibold">Op deze pagina</p>
      <ul className="space-y-1 text-sm">
        {items.map((heading) => (
          <li key={heading.id} className={cn(heading.depth === 3 && "pl-3")}>
            <a
              href={`#${heading.id}`}
              className="text-muted-foreground hover:text-foreground block py-0.5 leading-snug transition-colors"
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/** The table of contents as a disclosure for narrow screens. */
export function ManualTocDisclosure({ headings }: { headings: ManualHeading[] }) {
  if (!headings.some((h) => h.depth === 2)) return null
  return (
    <details className="border-border group mt-6 rounded-lg border px-4 py-3 xl:hidden">
      <summary className="text-foreground flex cursor-pointer list-none items-center gap-1.5 text-sm font-medium select-none [&::-webkit-details-marker]:hidden">
        <ChevronRight
          className="text-muted-foreground size-4 transition-transform group-open:rotate-90"
          aria-hidden
        />
        <span>Op deze pagina</span>
      </summary>
      <ManualToc headings={headings} className="mt-3 [&>p]:hidden" />
    </details>
  )
}

/** Previous and next page in reading order. */
export function ManualPager({ prev, next }: { prev?: ManualNavItem; next?: ManualNavItem }) {
  if (!prev && !next) return null
  return (
    <nav aria-label="Vorige en volgende" className="mt-14 grid gap-3 sm:grid-cols-2">
      {prev ? (
        <Link
          to={prev.href}
          className="border-border hover:bg-muted/50 group rounded-lg border px-4 py-3 transition-colors"
        >
          <span className="text-muted-foreground flex items-center gap-1 text-sm">
            <ArrowLeft className="size-3.5" aria-hidden />
            <span>Vorige</span>
          </span>
          <span className="text-foreground mt-1 block font-medium">{prev.title}</span>
        </Link>
      ) : (
        <span className="hidden sm:block" />
      )}
      {next ? (
        <Link
          to={next.href}
          className="border-border hover:bg-muted/50 group rounded-lg border px-4 py-3 text-right transition-colors"
        >
          <span className="text-muted-foreground flex items-center justify-end gap-1 text-sm">
            <span>Volgende</span>
            <ArrowRight className="size-3.5" aria-hidden />
          </span>
          <span className="text-foreground mt-1 block font-medium">{next.title}</span>
        </Link>
      ) : null}
    </nav>
  )
}

/** Related pages listed under "Lees ook". */
export function ManualRelated({ items }: { items: ManualNavItem[] }) {
  if (items.length === 0) return null
  return (
    <section aria-labelledby="lees-ook" className="border-border mt-12 border-t pt-8">
      <h2 id="lees-ook" className="text-foreground mb-4 text-lg font-semibold">
        Lees ook
      </h2>
      <ul className="divide-border divide-y">
        {items.map((item) => (
          <li key={item.href}>
            <Link to={item.href} className="group block py-3">
              <span className="text-foreground font-medium group-hover:underline group-hover:underline-offset-4">
                {item.title}
              </span>
              {item.kind === "background" ? (
                <span className="text-muted-foreground ml-2 text-sm">Achtergrond</span>
              ) : null}
              <span className="text-muted-foreground mt-0.5 block text-sm leading-6">
                {item.description}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * A calm invitation for prospective users who land on the manual from a search engine. Signed-in
 * users are sent on to the app by the sign-in page.
 */
export function ManualSignupCard({
  placement,
  className,
}: {
  /** Where the card sits, for analytics: the right rail or inline after the content. */
  placement: "rail" | "inline"
  className?: string
}) {
  const { pathname } = useLocation()
  const { capture } = useAnalytics()
  return (
    <div className={cn("border-border bg-background rounded-xl border p-4", className)}>
      <p className="text-foreground text-sm font-semibold">Zelf aan de slag?</p>
      <p className="text-muted-foreground mt-1 mb-4 text-sm leading-6">
        Vul je percelen, gewassen en bemestingen in. {clientConfig.name} rekent de rest voor je uit.
      </p>
      <Button asChild size="sm" className="w-full">
        <Link
          to="/signin"
          onClick={() => capture(MANUAL_EVENTS.signupClicked, { manual_path: pathname, placement })}
        >
          Aanmelden
        </Link>
      </Button>
    </div>
  )
}
