import { data, redirect, useLoaderData } from "react-router"
import { ManualNotFound, ManualPageLayout } from "~/components/blocks/manual/page"
import { getManualPage, resolveManualAlias, toManualPageView } from "~/lib/manual/content.server"
import { getManualContext } from "~/lib/manual/context.server"
import { buildManualMeta } from "~/lib/manual/meta"
import { MANUAL_CACHE_CONTROL } from "~/lib/manual/seo"
import type { Route } from "./+types/manual.background.$slug"

export function loader({ params }: Route.LoaderArgs) {
  const slug = params.slug
  const page = getManualPage("background", slug)
  if (!page) {
    const target = resolveManualAlias("background", slug)
    if (target) throw redirect(target.href, 301)
    throw data("Pagina niet gevonden", { status: 404 })
  }
  const { tokens, seo } = getManualContext()
  return {
    page: toManualPageView(page, tokens),
    keywords: page.frontmatter.keywords,
    image: page.frontmatter.image,
    seo,
  }
}

export function headers() {
  return { "Cache-Control": MANUAL_CACHE_CONTROL }
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: "Pagina niet gevonden | Handleiding" }]
  const { page, seo, keywords } = loaderData
  return buildManualMeta({
    title: page.title,
    description: page.description,
    path: page.href,
    breadcrumb: [
      { title: "Handleiding", path: "/manual" },
      { title: "Achtergrond", path: "/manual/background" },
      { title: page.title, path: page.href },
    ],
    seo,
    type: "article",
    modified: page.modified,
    keywords,
  })
}

export default function ManualBackgroundPage() {
  const { page } = useLoaderData<typeof loader>()
  return <ManualPageLayout key={page.href} page={page} />
}

export function ErrorBoundary() {
  return <ManualNotFound />
}
