import { useLoaderData } from "react-router"
import { ManualIndexSection } from "~/components/blocks/manual/index-list"
import { ManualIndexLayout } from "~/components/blocks/manual/page"
import { clientConfig } from "~/lib/config"
import { getManualNav } from "~/lib/manual/content.server"
import { getManualContext } from "~/lib/manual/context.server"
import { slugify } from "~/lib/manual/markdown"
import { buildManualMeta } from "~/lib/manual/meta"
import { MANUAL_CACHE_CONTROL } from "~/lib/manual/seo"
import type { Route } from "./+types/manual.background._index"

export function loader() {
  const { tokens, seo } = getManualContext()
  return { sections: getManualNav(tokens).filter((s) => s.kind === "background"), seo }
}

export function headers() {
  return { "Cache-Control": MANUAL_CACHE_CONTROL }
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return []
  const { seo } = loaderData
  return buildManualMeta({
    title: "Achtergrond",
    description: `Hoe ${seo.appName} de stikstofbalans, gebruiksruimte, het bemestingsadvies en de bodemkwaliteit berekent, en hoe je de uitkomsten leest.`,
    path: "/manual/background",
    breadcrumb: [
      { title: "Handleiding", path: "/manual" },
      { title: "Achtergrond", path: "/manual/background" },
    ],
    seo,
    type: "website",
  })
}

export default function ManualBackgroundIndex() {
  const { sections } = useLoaderData<typeof loader>()
  return (
    <ManualIndexLayout
      slug="background"
      breadcrumb={[{ href: "/manual", title: "Handleiding" }, { title: "Achtergrond" }]}
      title="Achtergrond"
      lede={
        <p>
          Wat er achter de uitkomsten van {clientConfig.name} zit: welke gegevens meetellen, hoe er
          wordt gerekend, hoe je het resultaat leest en waar de grenzen van de berekening liggen.
        </p>
      }
    >
      {sections.map((section) => (
        <ManualIndexSection
          key={section.title}
          id={slugify(section.title)}
          title={section.title}
          items={section.items}
        />
      ))}
    </ManualIndexLayout>
  )
}
