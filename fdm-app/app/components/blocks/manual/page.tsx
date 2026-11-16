import { Fragment, type ReactNode, useEffect } from "react"
import { Link, useLocation } from "react-router"
import type { ManualPageView } from "~/lib/manual/parse"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb"
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

/** A trail of links from the manual index to the current page. */
export function ManualBreadcrumb({ items }: { items: { href?: string; title: string }[] }) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        {items.map((item, index) => (
          <Fragment key={item.title}>
            {index > 0 ? <BreadcrumbSeparator /> : null}
            <BreadcrumbItem>
              {item.href ? (
                <BreadcrumbLink render={<Link to={item.href}>{item.title}</Link>} />
              ) : (
                <BreadcrumbPage>{item.title}</BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
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
      <main className="mx-auto max-w-[38rem] min-w-0 flex-1">
        <ManualBreadcrumb items={breadcrumb} />
        <h1 className="text-foreground mt-4 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {page.title}
        </h1>
        <p className="text-muted-foreground mt-3 text-xl leading-relaxed text-pretty">
          {page.description}
        </p>
        {page.inApp ? <ManualInAppPath labels={page.inApp} /> : null}
        <ManualTocDisclosure headings={page.headings} />
        <ManualArticle markdown={page.body} className="border-border mt-8 border-t pt-8" />
        <ManualSignupCard placement="inline" className="mt-10 xl:hidden" />
        <ManualRelated items={page.related} />
        <ManualPager prev={page.prev} next={page.next} />
      </main>
      <aside className="hidden w-56 shrink-0 xl:block">
        {/* The contents scroll on their own, so the sign-up card stays visible below them. */}
        <div className="sticky top-22 flex max-h-[calc(100vh-6.5rem)] flex-col gap-8 pb-8">
          <ManualToc
            headings={page.headings}
            className="min-h-0 [scrollbar-width:thin] overflow-y-auto"
          />
          <ManualSignupCard placement="rail" className="shrink-0" />
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
