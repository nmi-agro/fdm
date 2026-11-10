import { describe, expect, it } from "vitest"
import { manualUrlTransform, slugify, substituteTokens } from "./markdown"
import { parseManualMarkdown } from "./parse"

describe("slugify", () => {
  it("removes diacritics and replaces & with en", () => {
    expect(slugify("Bodem & bemesting: één keer")).toBe("bodem-en-bemesting-een-keer")
    expect(slugify("Variëteit en gewasresten")).toBe("varieteit-en-gewasresten")
  })

  it("collapses punctuation and trims hyphens", () => {
    expect(slugify("  Hulp nodig?  ")).toBe("hulp-nodig")
    expect(slugify("P₂O₅ (fosfaat)")).toBe("p2o5-fosfaat")
  })

  it("falls back to a generic slug for text without letters", () => {
    expect(slugify("???")).toBe("sectie")
  })
})

describe("remarkHeadingIds", () => {
  const ids = (markdown: string) =>
    parseManualMarkdown(markdown)
      .children.filter((node) => node.type === "heading")
      .map((node) => (node.data as { id?: string }).id)

  it("slugifies heading text", () => {
    expect(ids("## Een gewas toevoegen")).toEqual(["een-gewas-toevoegen"])
  })

  it("uses and strips an explicit id", () => {
    const tree = parseManualMarkdown("## Gerrit, de AI-assistent {#gerrit}")
    const heading = tree.children[0]
    expect((heading.data as { id?: string }).id).toBe("gerrit")
    expect(JSON.stringify(heading)).not.toContain("{#gerrit}")
  })

  it("deduplicates ids within one document", () => {
    expect(ids("## Let op\n\n## Let op\n\n## Let op")).toEqual(["let-op", "let-op-2", "let-op-3"])
  })
})

describe("manualUrlTransform", () => {
  it("keeps screenshot URLs", () => {
    expect(manualUrlTransform("screenshot:bouwplan-tabel")).toBe("screenshot:bouwplan-tabel")
  })

  it("strips unsafe protocols", () => {
    expect(manualUrlTransform("javascript:alert(1)")).toBe("")
  })

  it("keeps internal and https links", () => {
    expect(manualUrlTransform("/manual/bouwplan#tip")).toBe("/manual/bouwplan#tip")
    expect(manualUrlTransform("https://example.org")).toBe("https://example.org")
  })
})

describe("substituteTokens", () => {
  it("replaces known tokens and leaves unknown ones", () => {
    expect(
      substituteTokens("{{appName}} op {{ appUrl }} met {{other}}", {
        appName: "Demo",
        appUrl: "https://demo.example",
        apiDocsUrl: "https://api.demo.example/docs",
        mcpUrl: "https://mcp.demo.example",
      }),
    ).toBe("Demo op https://demo.example met {{other}}")
  })
})
