import type { ManualKind } from "./parse"

/** A place in the manual that an in-app help link points to. */
export interface HelpTarget {
  kind: ManualKind
  slug: string
  /** Heading id on the page. Use an explicit `{#id}` in the content so the anchor stays stable. */
  anchor?: string
}

/**
 * Every place in the manual that the app links to. The content tests check that each target
 * resolves to an existing page and heading, so renaming a heading cannot silently break a link.
 */
export const helpTargets = {
  "zo-werkt-het": { kind: "chapter", slug: "zo-werkt-het" },
  "aan-de-slag": { kind: "chapter", slug: "aan-de-slag" },
  "bedrijf-aanmaken": { kind: "chapter", slug: "bedrijf-aanmaken" },
  "percelen-importeren": {
    kind: "chapter",
    slug: "bedrijf-aanmaken",
    anchor: "percelen-importeren",
  },
  "percelen-toevoegen": { kind: "chapter", slug: "bedrijf-aanmaken", anchor: "percelen-toevoegen" },
  bedrijfsinstellingen: {
    kind: "chapter",
    slug: "bedrijf-aanmaken",
    anchor: "bedrijfsinstellingen",
  },
  dashboard: { kind: "chapter", slug: "zo-werkt-het", anchor: "bedrijfsdashboard" },
  percelen: { kind: "chapter", slug: "percelen" },
  gewassen: { kind: "chapter", slug: "percelen", anchor: "gewas-toevoegen" },
  bouwplan: { kind: "chapter", slug: "bouwplan" },
  bodem: { kind: "chapter", slug: "bodem" },
  "bodemanalyses-uploaden": { kind: "chapter", slug: "bodem", anchor: "bodemanalyses-uploaden" },
  bodemconditiescore: { kind: "chapter", slug: "bodem", anchor: "bodemconditiescore" },
  meststoffen: { kind: "chapter", slug: "bemesting", anchor: "meststoffen" },
  bemesting: { kind: "chapter", slug: "bemesting" },
  tijdlijn: { kind: "chapter", slug: "tijdlijn" },
  atlas: { kind: "chapter", slug: "atlas" },
  balansen: { kind: "chapter", slug: "balansen" },
  stikstofbalans: { kind: "chapter", slug: "balansen", anchor: "stikstofbalans" },
  "organische-stofbalans": { kind: "chapter", slug: "balansen", anchor: "organische-stofbalans" },
  gebruiksruimte: { kind: "chapter", slug: "gebruiksruimte" },
  bemestingsadvies: { kind: "chapter", slug: "bemestingsadvies" },
  bodemkwaliteit: { kind: "chapter", slug: "bodemkwaliteit" },
  maatregelen: { kind: "chapter", slug: "bodemkwaliteit", anchor: "maatregelen" },
  labs: { kind: "chapter", slug: "labs" },
  mineralisatie: { kind: "chapter", slug: "labs", anchor: "mineralisatie" },
  gerrit: { kind: "chapter", slug: "labs", anchor: "gerrit" },
  bemestingsplan: { kind: "chapter", slug: "bemestingsplan" },
  samenwerken: { kind: "chapter", slug: "samenwerken" },
  toegang: { kind: "chapter", slug: "samenwerken", anchor: "toegang" },
  organisaties: { kind: "chapter", slug: "samenwerken", anchor: "organisaties" },
  account: { kind: "chapter", slug: "account" },
  "api-sleutels": { kind: "chapter", slug: "account", anchor: "api-sleutels" },
  hulp: { kind: "chapter", slug: "hulp" },
  "achtergrond-stikstofbalans": { kind: "background", slug: "stikstofbalans" },
  "achtergrond-organische-stofbalans": { kind: "background", slug: "organische-stofbalans" },
  "achtergrond-gebruiksruimte": { kind: "background", slug: "gebruiksruimte" },
  "achtergrond-bemestingsadvies": { kind: "background", slug: "bemestingsadvies" },
  "achtergrond-bln3-bodemkwaliteit": { kind: "background", slug: "bln3-bodemkwaliteit" },
  "achtergrond-bodemanalyse": { kind: "background", slug: "bodemanalyse" },
  "achtergrond-mineralisatie": { kind: "background", slug: "mineralisatie" },
} as const satisfies Record<string, HelpTarget>

/** The id of a help target, such as `"bouwplan"`. */
export type HelpTargetId = keyof typeof helpTargets

/**
 * Route `handle` that tells the help links which manual page explains the route. The deepest
 * route that sets `help` wins.
 *
 * @example
 * export const handle: HelpHandle = { help: "bouwplan" }
 */
export interface HelpHandle {
  help?: HelpTargetId
  /** Other handle fields of the route, such as `hideNavigationProgress`. */
  [key: string]: unknown
}

/**
 * Returns the URL of a help target.
 *
 * @param id - The help target.
 * @returns For example `/manual/bodem#bodemconditiescore`.
 */
export function getHelpHref(id: HelpTargetId): string {
  const target: HelpTarget = helpTargets[id]
  const path =
    target.kind === "chapter" ? `/manual/${target.slug}` : `/manual/background/${target.slug}`
  return target.anchor ? `${path}#${target.anchor}` : path
}
