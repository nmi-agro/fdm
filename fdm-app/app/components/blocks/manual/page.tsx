import { type ReactNode, useEffect } from "react"
import { Link, useLocation } from "react-router"
import type { ManualPageView } from "~/lib/manual/types"
import { useAnalytics } from "~/hooks/use-analytics"
import { useManualPageView } from "~/hooks/use-manual-page-view"
import { MANUAL_EVENTS } from "~/lib/manual/analytics"
import { ManualArticle } from "./article"
import {
  ManualInAppPath,
  ManualPager,
  ManualRelated,
  ManualSignupCard,
  ManualToc,
  ManualTocDisclosure,
} from "./parts"

const dateFormat = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
})

function formatDate(date: string): string {
  return dateFormat.format(new Date(`${date}T00:00:00Z`))
}

/** A trail of links from the manual index to the current page. */
export function ManualBreadcrumb({ items }: { items: { href?: string; title: string }[] }) {
  return (
    <nav aria-label="Kruimelpad">
      <ol className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 text-sm">
        {items.map((item, index) => (
          <li key={item.title} className="flex items-center gap-1.5">
            {index > 0 ? <span aria-hidden>/</span> : null}
            {item.href ? (
              <Link to={item.href} className="hover:text-foreground transition-colors">
                {item.title}
              </Link>
            ) : (
              <span aria-current="page" className="text-foreground">
                {item.title}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

/**
 * Layout of an index page: a title and lede, the content, and a right rail with the sign-up
 * card on wide screens.
 */
export function ManualIndexLayout({
  slug,
  breadcrumb,
  title,
  lede,
  children,
}: {
  /** Identifies the index page in analytics, such as `manual` or `background`. */
  slug: string
  breadcrumb: { href?: string; title: string }[]
  title: string
  lede: ReactNode
  children: ReactNode
}) {
  useManualPageView({ manual_kind: "index", manual_slug: slug })
  return (
    <div className="flex gap-12 py-8 sm:py-10">
      <main className="max-w-[44rem] min-w-0 flex-1">
        <ManualBreadcrumb items={breadcrumb} />
        <h1 className="text-foreground mt-4 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {title}
        </h1>
        <div className="text-muted-foreground mt-3 max-w-[38rem] text-xl leading-relaxed text-pretty">
          {lede}
        </div>
        {children}
        <ManualSignupCard placement="inline" className="mt-12 xl:hidden" />
      </main>
      <aside className="hidden w-56 shrink-0 xl:block">
        <div className="sticky top-22">
          <ManualSignupCard placement="rail" />
        </div>
      </aside>
    </div>
  )
}

/** Layout of a chapter or background page. */
export function ManualPageLayout({ page }: { page: ManualPageView }) {
  useManualPageView({
    manual_kind: page.kind,
    manual_slug: page.slug,
    manual_section: page.section,
  })
  const isBackground = page.kind === "background"
  const breadcrumb = isBackground
    ? [
        { href: "/manual", title: "Handleiding" },
        { href: "/manual/background", title: "Achtergrond" },
        { title: page.title },
      ]
    : [{ href: "/manual", title: "Handleiding" }, { title: page.title }]

  return (
    <div className="flex gap-12 py-8 sm:py-10">
      <main className="max-w-[38rem] min-w-0 flex-1">
        <ManualBreadcrumb items={breadcrumb} />
        <h1 className="text-foreground mt-4 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {page.title}
        </h1>
        <p className="text-muted-foreground mt-3 text-xl leading-relaxed text-pretty">
          {page.description}
        </p>
        {page.lastReviewed ? (
          <p className="text-muted-foreground mt-3 text-sm">
            Bijgewerkt op {formatDate(page.lastReviewed)}
          </p>
        ) : null}
        {page.inApp ? <ManualInAppPath labels={page.inApp} /> : null}
        <ManualTocDisclosure headings={page.headings} />
        <ManualArticle markdown={page.body} className="border-border mt-8 border-t pt-8" />
        {isBackground ? <ManualSignupCard placement="inline" className="mt-10 xl:hidden" /> : null}
        <ManualRelated items={page.related} />
        <ManualPager prev={page.prev} next={page.next} />
      </main>
      <aside className="hidden w-56 shrink-0 xl:block">
        <div className="sticky top-22 max-h-[calc(100vh-6.5rem)] space-y-8 overflow-y-auto pb-8">
          <ManualToc headings={page.headings} />
          {isBackground ? <ManualSignupCard placement="rail" /> : null}
        </div>
      </aside>
    </div>
  )
}

/** Shown inside the manual frame when a page does not exist. */
export function ManualNotFound() {
  const { pathname } = useLocation()
  const { capture } = useAnalytics()
  useEffect(() => {
    capture(MANUAL_EVENTS.pageNotFound, { path: pathname })
  }, [capture, pathname])
  return (
    <main className="max-w-[65ch] py-16">
      <h1 className="text-foreground text-3xl font-semibold tracking-tight">
        Deze pagina bestaat niet
      </h1>
      <p className="text-foreground/90 mt-4 text-lg leading-8">
        Misschien is het hoofdstuk verplaatst of heeft het een andere naam gekregen. Kies een
        hoofdstuk in het menu, of begin bij het overzicht.
      </p>
      <Link
        to="/manual"
        className="text-foreground mt-6 inline-block font-medium underline underline-offset-4"
      >
        Naar het overzicht van de handleiding
      </Link>
    </main>
  )
}
