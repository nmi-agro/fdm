import { describe, expect, it } from "vitest"
import { buildManualMeta } from "./seo"
import { buildRobotsTxt, buildSitemapXml, normalizeOrigin } from "./seo"

describe("buildRobotsTxt", () => {
  it("disallows everything when indexing is off", () => {
    expect(buildRobotsTxt(false, "https://app.example.org")).toBe("User-agent: *\nDisallow: /\n")
  })

  it("allows public pages, disallows the app and points to the sitemap when indexing is on", () => {
    const robots = buildRobotsTxt(true, "https://app.example.org")
    expect(robots).toContain("Allow: /")
    expect(robots).toContain("Disallow: /farm")
    expect(robots).not.toMatch(/^Disallow: \/$/m)
    expect(robots).not.toContain("Disallow: /manual")
    expect(robots).toContain("Sitemap: https://app.example.org/sitemap.xml")
  })
})

describe("buildSitemapXml", () => {
  it("lists absolute, escaped URLs with lastmod", () => {
    const xml = buildSitemapXml(
      [{ path: "/manual" }, { path: "/manual/a&b", lastmod: "2026-11-05" }],
      "https://app.example.org",
    )
    expect(xml).toContain("<loc>https://app.example.org/manual</loc>")
    expect(xml).toContain(
      "<loc>https://app.example.org/manual/a&amp;b</loc><lastmod>2026-11-05</lastmod>",
    )
  })
})

describe("normalizeOrigin", () => {
  it("strips trailing slashes and handles a missing URL", () => {
    expect(normalizeOrigin("https://app.example.org/")).toBe("https://app.example.org")
    expect(normalizeOrigin(undefined)).toBe("")
    expect(normalizeOrigin("undefined")).toBe("")
  })
})

describe("buildManualMeta", () => {
  const seo = { origin: "https://app.example.org", appName: "Demo", indexing: true }
  const base = {
    title: "Hulp nodig?",
    description: "Uitleg",
    path: "/manual/hulp",
    breadcrumb: [
      { title: "Handleiding", path: "/manual" },
      { title: "Hulp nodig?", path: "/manual/hulp" },
    ],
    seo,
    type: "article" as const,
  }

  it("sets title, canonical and structured data", () => {
    const meta = buildManualMeta({ ...base, faq: [{ question: "Vraag?", answer: "Antwoord." }] })
    expect(meta).toContainEqual({ title: "Hulp nodig? | Handleiding | Demo" })
    expect(meta).toContainEqual({
      tagName: "link",
      rel: "canonical",
      href: "https://app.example.org/manual/hulp",
    })
    const ld = meta.find((m) => "script:ld+json" in m) as {
      "script:ld+json": { "@graph": { "@type": string }[] }
    }
    expect(ld["script:ld+json"]["@graph"].map((g) => g["@type"])).toEqual([
      "BreadcrumbList",
      "TechArticle",
      "FAQPage",
    ])
    expect(meta).not.toContainEqual({ name: "robots", content: "noindex, nofollow" })
  })

  it("adds noindex when indexing is off", () => {
    const meta = buildManualMeta({ ...base, seo: { ...seo, indexing: false } })
    expect(meta).toContainEqual({ name: "robots", content: "noindex, nofollow" })
  })
})
