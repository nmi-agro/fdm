/**
 * Lists the routes of the built app, for the route crawler of the `smoke` project.
 *
 * The list comes from the server build (`build/server/index.js`): its `routes` export has the
 * route tree and its `assets` export tells which routes render a page. The build is imported in
 * a child process, so the app's server modules (database, auth) never load in the test runner.
 */
import { execFileSync } from "node:child_process"
import { APP_ROOT } from "./env"

/** One URL pattern of the app, such as `/farm/:b_id_farm/:calendar/field`. */
export interface AppRoute {
  /** The URL pattern, with React Router's `:param` and `*` syntax. */
  pattern: string
  /** The id of the route that renders the pattern, such as `routes/farm._index`. */
  id: string
  /** Whether the route renders a page (`true`) or is a resource route that returns data. */
  page: boolean
  /**
   * Whether a GET request runs a loader for this URL: for a page any loader in its route chain
   * (the root has one), for a resource route only its own.
   */
  hasLoader: boolean
}

interface BuildRoute {
  id: string
  parentId?: string
  path?: string
  index?: boolean
}

interface BuildAsset {
  hasLoader: boolean
  hasDefaultExport?: boolean
  hasErrorBoundary: boolean
}

const LIST_SCRIPT = `
const build = await import("./build/server/index.js")
const routes = Object.values(build.routes).map(({ id, parentId, path, index }) => ({ id, parentId, path, index }))
// Exit once the output is written: on Linux, stdout to a pipe is asynchronous, and exiting
// earlier cuts the list short. The server modules keep handles open, so exit explicitly.
process.stdout.write(JSON.stringify({ routes, assets: build.assets.routes }), () => process.exit(0))
`

/**
 * Builds the URL patterns from the route tree. Each pattern is rendered by an index route when
 * it has one, else by the route that declares the path.
 *
 * @param routes - The routes of the build.
 * @param assets - The client manifest entries of the routes, by id.
 * @returns The patterns, sorted.
 */
export function toAppRoutes(routes: BuildRoute[], assets: Record<string, BuildAsset>): AppRoute[] {
  const byId = new Map(routes.map((route) => [route.id, route]))
  const fullPath = (route: BuildRoute | undefined): string[] =>
    route ? [...fullPath(byId.get(route.parentId ?? "")), ...(route.path ? [route.path] : [])] : []
  const chainHasLoader = (route: BuildRoute | undefined): boolean =>
    route
      ? Boolean(assets[route.id]?.hasLoader) || chainHasLoader(byId.get(route.parentId ?? ""))
      : false

  const byPattern = new Map<string, BuildRoute>()
  for (const route of routes) {
    if (route.id === "root" || (!route.path && !route.index)) continue
    const pattern = `/${fullPath(route).join("/")}`
    const current = byPattern.get(pattern)
    if (!current || route.index) byPattern.set(pattern, route)
  }

  return [...byPattern]
    .map(([pattern, route]) => {
      const asset = assets[route.id]
      const page = Boolean(asset?.hasDefaultExport || asset?.hasErrorBoundary)
      const hasLoader = page ? chainHasLoader(route) : Boolean(asset?.hasLoader)
      return { pattern, id: route.id, page, hasLoader }
    })
    .sort((a, b) => a.pattern.localeCompare(b.pattern))
}

/**
 * Lists the URL patterns of the production build in `build/`.
 *
 * @returns The patterns, sorted.
 * @throws When the app has not been built.
 */
export function listAppRoutes(): AppRoute[] {
  const output = execFileSync(process.execPath, ["--input-type=module", "-e", LIST_SCRIPT], {
    cwd: APP_ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    // The server modules check a few settings when they load; the values are not used.
    env: {
      ...process.env,
      FDM_SESSION_SECRET: process.env.FDM_SESSION_SECRET || "route-listing",
      POSTGRES_PORT: process.env.POSTGRES_PORT || "5432",
      BETTER_AUTH_URL: process.env.BETTER_AUTH_URL || "http://localhost",
    },
  })
  const { routes, assets } = JSON.parse(output) as {
    routes: BuildRoute[]
    assets: Record<string, BuildAsset>
  }
  return toAppRoutes(routes, assets)
}
