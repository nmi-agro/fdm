/**
 * How the route crawler fills in the params of each URL pattern, and which patterns it skips.
 *
 * Every pattern of the app must either resolve to a URL here or be listed in {@link SKIP} with
 * a reason. A new route with a param that is not covered fails the crawler, so it cannot drop
 * out of the smoke test unnoticed: add a resolver or a skip entry.
 */
import type { FeatureCollection, Polygon } from "geojson"
import { readFileSync } from "node:fs"
import type { DemoFieldKey } from "../seed/demo-farm"
import type { SmokeFarm } from "./smoke-farm"

/**
 * Patterns the crawler does not visit, with the reason. Keep the reasons specific, so it stays
 * clear when a skip can be removed.
 */
export const SKIP: Record<string, string> = {
  // Handled by better-auth or external services, or only reachable from them
  "/api/auth/*": "better-auth endpoints; the sign-in in the setup covers them",
  "/callback/rvo": "OAuth callback of RVO, an external service",
  "/ingest/*": "proxy to PostHog, an external service",
  "/atlas/ahn-index": "fetches the AHN elevation index from an external service",
  "/farm/:b_id_farm/:calendar/atlas/soil/bodemdata/:soilcode":
    "proxy to bodemdata.nl, an external service",
  "/api/gerrit/clarify": "calls Gemini, an external service",
  "/api/gerrit/stream": "calls Gemini, an external service",
  "/api/lookup/kvk": "calls the KvK API, an external service",
  "/farm/:b_id_farm/:calendar/atlas/fields/:centroid":
    "shows the error page without an NMI API key, which the smoke suite does not have; the page should show an unavailable state instead",
  "/api/profile-picture/:type/:file_name": "reads files from Google Cloud Storage",
  "/api/webhooks/inbound-email-ticket/:secret":
    "webhook of the mail service, protected by a secret",

  // Need data that the minimal seed does not create
  "/api/:object_type/download/:a_id.pdf": "needs a stored lab report or fertilizer plan",
  "/api/helpdesk/download/:attachment_id": "needs a helpdesk ticket with an attachment",
  "/farm/:b_id_farm/:calendar/field/:b_id/bcs/:a_id": "needs a soil condition assessment",
  "/farm/:b_id_farm/:calendar/field/:b_id/bcs/:a_id/edit": "needs a soil condition assessment",
  "/farm/:b_id_farm/bemestingsplan/:p_id_plan": "needs a fertilizer plan",
  "/organization/invitations/:invitation_id/respond": "needs an organization invitation",
  "/support/settings/agents/:agent_id": "needs a helpdesk agent",
  "/support/ticket/:ticket_id": "needs a helpdesk ticket",
}

/**
 * Pages that answer with another status than 200 on purpose, with the reason. The crawler checks
 * that they answer with exactly this status, which also covers the permission check.
 */
export const EXPECTED_STATUS: Record<string, { status: number; reason: string }> = {
  "/support/settings/absences": { status: 403, reason: "only for helpdesk agents" },
  "/support/settings/agents": { status: 403, reason: "only for helpdesk agents" },
  "/support/settings/blocked-emails": { status: 403, reason: "only for helpdesk agents" },
  "/support/settings/profile": { status: 403, reason: "only for helpdesk agents" },
}

/**
 * The query string of pages that are opened from a selection, as the app's links build it.
 * Params in it are filled in like those of the path.
 */
const QUERIES: Record<string, string> = {
  "/farm/:b_id_farm/:calendar/field/modify_fertilizer/:p_id": "fieldIds=:b_id",
  "/farm/:b_id_farm/:calendar/rotation/modify_fertilizer/:p_id": "fieldIds=:b_id",
  "/farm/create/:b_id_farm/:calendar/rotation/modify_fertilizer/:p_id": "fieldIds=:b_id",
  "/farm/:b_id_farm/:calendar/rotation/modify_harvest": "harvestingIds=:b_id_harvesting",
  "/farm/create/:b_id_farm/:calendar/rotation/modify_harvest": "harvestingIds=:b_id_harvesting",
  "/farm/:b_id_farm/:calendar/rotation/fertilizer": "cultivationIds=:b_lu_catalogue&fieldIds=:b_id",
  "/farm/:b_id_farm/:calendar/rotation/harvest": "cultivationIds=:b_lu_catalogue&fieldIds=:b_id",
}

/** A known error on a page, ignored by the crawler until it is fixed. */
export interface KnownError {
  /** Matches the problem as the crawler reports it. */
  match: RegExp
  /** What is wrong, so it can be fixed and removed from this list. */
  reason: string
}

/**
 * Known errors per pattern. Every entry is a bug in the app: fix it and remove the entry. The
 * crawler still fails on any other problem on these pages.
 */
export const KNOWN_ERRORS: Record<string, KnownError[]> = {
  "/farm/:b_id_farm/:calendar/atlas/elevation": [
    {
      match: /Cannot add layer "ahn-wms-layer" before non-existing layer "fieldsSavedOutline"/,
      reason:
        "The AHN layer is rendered before the fields source it is placed under, so MapLibre cannot find the field layer yet.",
    },
  ],
}

/** The field whose records fill in the field params: it has a crop with a harvest. */
const FIELD: DemoFieldKey = "tarwe"

/** The fertilizer applied on {@link FIELD} (KAS in the BAAT catalogue). */
const FERTILIZER_CATALOGUE_ID = "BAAT028"

/**
 * Returns a point inside the field, as `longitude,latitude`, for the atlas field page.
 *
 * @param key - The field.
 * @returns The average of the outline's corners, which lies inside these convex outlines.
 */
function fieldCentroid(key: DemoFieldKey): string {
  const outlines = JSON.parse(
    readFileSync(new URL("../seed/fields.geojson", import.meta.url), "utf8"),
  ) as FeatureCollection<Polygon, { key: DemoFieldKey }>
  const feature = outlines.features.find((f) => f.properties.key === key)
  if (!feature) throw new Error(`fields.geojson has no outline for ${key}`)
  const ring = feature.geometry.coordinates[0].slice(0, -1)
  const lon = ring.reduce((sum, [x]) => sum + x, 0) / ring.length
  const lat = ring.reduce((sum, [, y]) => sum + y, 0) / ring.length
  return `${lon.toFixed(6)},${lat.toFixed(6)}`
}

/**
 * Returns the value for a param, or `undefined` when there is none.
 *
 * @param name - The param name, without `:`.
 * @param pattern - The whole pattern, for params whose meaning depends on the route.
 * @param farm - The seeded data.
 */
function paramValue(name: string, pattern: string, farm: SmokeFarm): string | undefined {
  const field = farm.records[FIELD]
  switch (name) {
    case "b_id_farm":
      return farm.farm
    case "calendar":
      return String(farm.year)
    case "b_id":
      return farm.fields[FIELD]
    case "b_lu":
      return field?.cultivations[0]
    case "b_id_harvesting":
      return field?.harvests[0]
    case "a_id":
      return field?.soilAnalyses[0]
    case "p_id":
      return farm.fertilizers[FERTILIZER_CATALOGUE_ID]
    case "analysis_type":
      return "standard"
    case "centroid":
      return fieldCentroid(FIELD)
    case "b_lu_catalogue":
      return "nl_233" // Tarwe, winter-: the crop of the field
    case "slug":
      if (pattern === "/manual/:slug") return "aan-de-slag"
      if (pattern === "/manual/background/:slug") return "stikstofbalans"
      if (pattern.startsWith("/organization/:slug")) return farm.organization.slug
      return undefined
    case "b_id_group":
      return farm.organization.group
    default:
      return undefined
  }
}

/** The result of resolving a pattern. */
export type ResolvedRoute = { url: string } | { skip: string } | { missing: string[] }

/**
 * Fills in the params of a URL pattern with the seeded data.
 *
 * @param pattern - A pattern such as `/farm/:b_id_farm/:calendar/field/:b_id`.
 * @param farm - The seeded data.
 * @returns The URL, the reason to skip it, or the params that could not be filled in.
 */
export function resolveRoute(pattern: string, farm: SmokeFarm): ResolvedRoute {
  if (pattern in SKIP) return { skip: SKIP[pattern] }
  const missing: string[] = []
  const fill = (template: string) =>
    template.replace(/:(\w+)|\*/g, (match: string, name?: string) => {
      const value = name ? paramValue(name, pattern, farm) : undefined
      if (value === undefined) {
        missing.push(match)
        return match
      }
      return encodeURIComponent(value).replace(/%2C/g, ",")
    })
  const query = QUERIES[pattern]
  const url = fill(pattern) + (query ? `?${fill(query)}` : "")
  return missing.length > 0 ? { missing } : { url }
}
