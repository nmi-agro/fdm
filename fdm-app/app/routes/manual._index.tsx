import { useLoaderData } from "react-router"
import { UiLabel } from "~/components/blocks/manual/article"
import { ManualIndexSection } from "~/components/blocks/manual/index-list"
import { ManualIndexLayout } from "~/components/blocks/manual/page"
import { clientConfig } from "~/lib/config"
import { getManualNav } from "~/lib/manual/content.server"
import { getManualContext } from "~/lib/manual/context.server"
import { slugify } from "~/lib/manual/markdown"
import { buildManualMeta } from "~/lib/manual/meta"
import { MANUAL_CACHE_CONTROL } from "~/lib/manual/seo"
import type { Route } from "./+types/manual._index"

export function loader() {
  const { tokens, seo } = getManualContext()
  return { sections: getManualNav(tokens), seo }
}

export function headers() {
  return { "Cache-Control": MANUAL_CACHE_CONTROL }
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return []
  const { seo } = loaderData
  return buildManualMeta({
    title: "Handleiding",
    description: `Hoe je ${seo.appName} gebruikt: van je eerste bedrijf en percelen tot het lezen van de stikstofbalans, de gebruiksruimte en het bemestingsadvies.`,
    path: "/manual",
    breadcrumb: [{ title: "Handleiding", path: "/manual" }],
    seo,
    type: "website",
  })
}

export default function ManualIndex() {
  const { sections } = useLoaderData<typeof loader>()
  const chapters = sections.filter((s) => s.kind === "chapter")
  const background = sections.filter((s) => s.kind === "background").flatMap((s) => s.items)

  return (
    <ManualIndexLayout
      slug="manual"
      breadcrumb={[{ title: "Handleiding" }]}
      title="Handleiding"
      lede={
        <>
          <p>
            Hoe je {clientConfig.name} gebruikt, van je eerste bedrijf tot het lezen van de
            stikstofbalans. Knoppen en menu's staan in deze handleiding zoals je ze in de app ziet,
            bijvoorbeeld <UiLabel>Bouwplan</UiLabel> of <UiLabel>Bemesting</UiLabel>.
          </p>
        </>
      }
    >
      {chapters.map((section) => (
        <ManualIndexSection
          key={section.title}
          id={slugify(section.title)}
          title={section.title}
          items={section.items}
        />
      ))}
      <ManualIndexSection
        id="achtergrond"
        title="Hoe wordt het berekend?"
        intro="Wat er achter de uitkomsten zit: welke gegevens meetellen, hoe er wordt gerekend en hoe je het resultaat leest."
        items={background}
      />
    </ManualIndexLayout>
  )
}
