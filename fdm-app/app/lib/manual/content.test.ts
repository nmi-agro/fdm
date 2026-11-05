import { globSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import type { ManualPage } from "./parse"
import { getManualPage, manualPages, resolveManualRef } from "./content.server"
import { getHelpHref, type HelpTarget, helpTargets } from "./help-targets"
import { KNOWN_TOKENS, SCREENSHOT_PROTOCOL } from "./markdown"

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..")
const repoRoot = resolve(appRoot, "..")
const routesDir = resolve(appRoot, "app/routes")

function where(page: ManualPage, line?: number): string {
  return line ? `${page.file}:${line}` : page.file
}

/** Resolves an internal manual link (path plus optional anchor) to an error, or undefined. */
function checkInternalLink(href: string): string | undefined {
  const [path, anchor] = href.split("#")
  if (path === "/manual" || path === "/manual/background") {
    return anchor ? `anker #${anchor} op een overzichtspagina` : undefined
  }
  const match = /^\/manual\/(?:(background)\/)?([a-z0-9-]+)$/.exec(path)
  if (!match) return `onbekende handleiding-URL ${href}`
  const target = getManualPage(match[1] ? "background" : "chapter", match[2])
  if (!target) return `pagina ${path} bestaat niet`
  if (anchor && !target.headings.some((h) => h.id === anchor)) {
    return `anker #${anchor} bestaat niet op ${path}`
  }
  return undefined
}

describe("manual content", () => {
  it("has chapters and background pages", () => {
    expect(manualPages.some((page) => page.kind === "chapter")).toBe(true)
    expect(manualPages.some((page) => page.kind === "background")).toBe(true)
  })

  it("has unique slugs and aliases per kind", () => {
    for (const kind of ["chapter", "background"] as const) {
      const names = manualPages
        .filter((page) => page.kind === kind)
        .flatMap((page) => [page.slug, ...(page.frontmatter.aliases ?? [])])
      const duplicates = names.filter((name, index) => names.indexOf(name) !== index)
      expect(duplicates, `${kind}: dubbele slugs of aliassen`).toEqual([])
    }
  })

  it("has a valid heading structure", () => {
    const errors: string[] = []
    for (const page of manualPages) {
      let previous = 1
      for (const heading of page.headings) {
        if (heading.depth === 1) errors.push(`${where(page)}: gebruik geen h1 ("${heading.text}")`)
        if (heading.depth > previous + 1) {
          errors.push(`${where(page)}: kop "${heading.text}" slaat een niveau over`)
        }
        previous = heading.depth
      }
      const ids = page.headings.map((h) => h.id)
      const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index)
      if (duplicates.length > 0)
        errors.push(`${where(page)}: dubbele kop-ids ${duplicates.join(", ")}`)
    }
    expect(errors).toEqual([])
  })

  it("gives headings with a token an explicit id, so the anchor doesn't depend on the name", () => {
    const errors: string[] = []
    for (const page of manualPages) {
      for (const heading of page.headings) {
        if (/appname|appurl/.test(heading.id)) {
          errors.push(`${where(page)}: geef kop "${heading.text}" een {#id}`)
        }
      }
    }
    expect(errors).toEqual([])
  })

  it("has route and watch globs that match at least one file", () => {
    const errors: string[] = []
    for (const page of manualPages) {
      for (const pattern of page.frontmatter.routes) {
        if (globSync(pattern, { cwd: routesDir }).length === 0) {
          errors.push(`${where(page)}: routes-glob "${pattern}" vindt geen bestand`)
        }
      }
      for (const pattern of page.frontmatter.watch ?? []) {
        if (globSync(pattern, { cwd: repoRoot }).length === 0) {
          errors.push(`${where(page)}: watch-glob "${pattern}" vindt geen bestand`)
        }
      }
    }
    expect(errors).toEqual([])
  })

  it("has internal links that resolve", () => {
    const errors: string[] = []
    for (const page of manualPages) {
      for (const link of page.links) {
        if (link.value.startsWith("#")) {
          const anchor = link.value.slice(1)
          if (!page.headings.some((h) => h.id === anchor)) {
            errors.push(`${where(page, link.line)}: anker ${link.value} bestaat niet`)
          }
        } else if (link.value.startsWith("/")) {
          const error = checkInternalLink(link.value)
          if (error) errors.push(`${where(page, link.line)}: ${error}`)
        } else if (!/^(https:\/\/|mailto:|\{\{appUrl\}\})/.test(link.value)) {
          errors.push(`${where(page, link.line)}: link "${link.value}" moet https of /manual zijn`)
        }
      }
    }
    expect(errors).toEqual([])
  })

  it("has related entries that resolve and don't point to the page itself", () => {
    const errors: string[] = []
    for (const page of manualPages) {
      for (const ref of page.frontmatter.related ?? []) {
        const target = resolveManualRef(ref)
        if (!target) errors.push(`${where(page)}: related "${ref}" bestaat niet`)
        else if (target === page) errors.push(`${where(page)}: related verwijst naar zichzelf`)
      }
    }
    expect(errors).toEqual([])
  })

  it("only uses screenshot images", () => {
    const errors: string[] = []
    for (const page of manualPages) {
      for (const image of page.images) {
        if (!image.value.startsWith(SCREENSHOT_PROTOCOL)) {
          errors.push(`${where(page, image.line)}: gebruik ![tekst](screenshot:<id>)`)
        }
      }
    }
    expect(errors).toEqual([])
  })

  it("only uses known tokens", () => {
    const errors: string[] = []
    for (const page of manualPages) {
      for (const token of page.tokens) {
        if (!(KNOWN_TOKENS as readonly string[]).includes(token.value)) {
          errors.push(`${where(page, token.line)}: onbekend token {{${token.value}}}`)
        }
      }
    }
    expect(errors).toEqual([])
  })

  it("has frequently asked questions on the help chapter", () => {
    expect(getManualPage("chapter", "hulp")?.faq.length).toBeGreaterThan(0)
  })
})

describe("help targets", () => {
  it("resolve to an existing page and heading", () => {
    const errors: string[] = []
    for (const [id, target] of Object.entries(helpTargets) as [string, HelpTarget][]) {
      const page = getManualPage(target.kind, target.slug)
      if (!page) {
        errors.push(`${id}: pagina ${target.kind}/${target.slug} bestaat niet`)
      } else if (target.anchor && !page.headings.some((h) => h.id === target.anchor)) {
        errors.push(`${id}: anker #${target.anchor} bestaat niet op ${page.href}`)
      }
    }
    expect(errors).toEqual([])
  })

  it("build hrefs with the anchor", () => {
    expect(getHelpHref("bodemconditiescore")).toBe("/manual/bodem#bodemconditiescore")
    expect(getHelpHref("achtergrond-stikstofbalans")).toBe("/manual/background/stikstofbalans")
  })
})
