/**
 * Helpers for the loader and action tests of the `integration` Vitest project.
 */
import { createHmac, randomUUID } from "node:crypto"
import { type ComponentType, createElement } from "react"
import { prerender } from "react-dom/static"
import {
  type ActionFunctionArgs,
  createStaticHandler,
  createStaticRouter,
  type LoaderFunctionArgs,
  Outlet,
  StaticRouterProvider,
} from "react-router"
import { SidebarProvider } from "~/components/ui/sidebar"
import { TooltipProvider } from "~/components/ui/tooltip"
import { auth } from "~/lib/auth.server"
import { fdm } from "~/lib/fdm.server"
import type { DemoFarmIds } from "../e2e/seed/demo-farm"
import type { TestUser } from "./session"
import { seedFarm } from "../e2e/seed"

/** The origin of the requests that the helpers build. */
export const TEST_ORIGIN = "http://localhost"

/** A seeded user with a `minimal` farm. */
export interface SeededUser {
  user: TestUser
  ids: DemoFarmIds
}

/**
 * Creates a user with a `minimal` farm (two fields with crops, fertilisation and a soil
 * analysis). Every call creates a new user, so tests do not share data.
 *
 * @param label - A short word for the e-mail address, which helps when reading the database.
 * @returns The user and the ids of its farm.
 */
export async function seedUserWithFarm(label = "user"): Promise<SeededUser> {
  const suffix = randomUUID().slice(0, 8)
  const user = {
    email: `${label}-${suffix}@example.com`,
    username: `${label}_${suffix}`,
    firstname: "Test",
    surname: label,
  }
  const ids = await seedFarm(fdm as unknown as Parameters<typeof seedFarm>[0], {
    variant: "minimal",
    user,
    requireEmptyDatabase: false,
  })
  return {
    user: {
      id: ids.principalId,
      email: user.email,
      firstname: user.firstname,
      surname: user.surname,
    },
    ids,
  }
}

/**
 * Builds the arguments of a route loader, as React Router passes them.
 *
 * @param path - The path of the request, such as `/farm/abc`.
 * @param params - The route params.
 * @returns The arguments for `loader(...)`.
 */
export function loaderArgs(path: string, params: Record<string, string>): LoaderFunctionArgs {
  const url = new URL(path, TEST_ORIGIN)
  return {
    request: new Request(url),
    url,
    params,
    context: {},
    unstable_pattern: "",
  } as unknown as LoaderFunctionArgs
}

/**
 * Builds the arguments of a route action for a submitted form.
 *
 * @param path - The path of the request.
 * @param params - The route params.
 * @param form - The form fields.
 * @returns The arguments for `action(...)`.
 */
export function actionArgs(
  path: string,
  params: Record<string, string>,
  form: Record<string, string>,
): ActionFunctionArgs {
  const url = new URL(path, TEST_ORIGIN)
  return {
    request: new Request(url, { method: "POST", body: new URLSearchParams(form) }),
    url,
    params,
    context: {},
    unstable_pattern: "",
  } as unknown as ActionFunctionArgs
}

/** What a loader or action returned or threw, in a form that is easy to assert on. */
export interface RouteResult {
  /** The HTTP status: 200 for plain data. */
  status: number
  /** The redirect target, for redirects. */
  location?: string
  /** The data, for `data(...)` and plain objects. */
  data?: unknown
}

/**
 * Runs a loader or action and normalises its outcome: plain data, `data(...)`, a `Response`
 * (such as a redirect), or any of these thrown.
 *
 * @param run - Calls the loader or action.
 * @returns The status, redirect target and data.
 */
export async function runRoute(run: () => Promise<unknown>): Promise<RouteResult> {
  let value: unknown
  try {
    value = await run()
  } catch (error) {
    value = error
    if (!(error instanceof Response) && !isDataWithInit(error)) throw error
  }
  if (value instanceof Response) {
    return { status: value.status, location: value.headers.get("Location") ?? undefined }
  }
  if (isDataWithInit(value)) {
    const location = new Headers(value.init?.headers).get("Location") ?? undefined
    return { status: value.init?.status ?? 200, location, data: value.data }
  }
  return { status: 200, data: value }
}

/** The parts of a route module that {@link renderPage} uses. */
export interface PageModule {
  /** The page component. */
  default: ComponentType
  /**
   * The loader whose data the page reads with `useLoaderData`. A method, so that loaders typed
   * with the route's own params (`Route.LoaderArgs`) fit.
   */
  loader?(this: void, args: LoaderFunctionArgs): unknown
}

/**
 * Signs `user` in as a magic link does: marks the e-mail address as verified and creates a real
 * session. Returns its signed session cookie, for routes that ask better-auth about the request
 * (such as `auth.api.listOrganizations`) instead of calling `getSession`.
 *
 * @param user - The user, usually from {@link seedUserWithFarm}.
 * @returns A `Cookie` header value.
 */
export async function sessionCookie(user: TestUser): Promise<string> {
  const context = await (auth as unknown as { $context: Promise<AuthContext> }).$context
  await context.internalAdapter.updateUser(user.id, { emailVerified: true })
  const session = await context.internalAdapter.createSession(user.id)
  // Signed like better-auth does: the token, a dot and its base64 HMAC-SHA256 signature.
  const signature = createHmac("sha256", context.secret).update(session.token).digest("base64")
  const value = encodeURIComponent(`${session.token}.${signature}`)
  return `${context.authCookies.sessionToken.name}=${value}`
}

/** The parts of the better-auth context that {@link sessionCookie} uses. */
interface AuthContext {
  secret: string
  authCookies: { sessionToken: { name: string } }
  internalAdapter: {
    updateUser: (userId: string, data: { emailVerified: boolean }) => Promise<unknown>
    createSession: (userId: string) => Promise<{ token: string }>
  }
}

/** Options of {@link renderPage}. */
export interface RenderOptions {
  /** A `Cookie` header for the request, from {@link sessionCookie}. */
  cookie?: string
}

/** The providers that the app's root and layouts put around every page. */
function PageLayout() {
  return createElement(
    TooltipProvider,
    null,
    createElement(SidebarProvider, null, createElement(Outlet)),
  )
}

/**
 * Renders a page the way the server does: runs its loader for `path`, then renders its component
 * to HTML with the loader data, including data the loader defers. The page is rendered inside the
 * providers of the app's layouts, but without the layouts themselves, and effects and event
 * handlers do not run.
 *
 * @param page - The route module, such as `await import("~/routes/farm._index")`.
 * @param pattern - The route path with its params, such as `/farm/:b_id_farm/settings`.
 * @param path - The requested path, such as `/farm/abc/settings`.
 * @param options - Options for the request.
 * @returns The rendered HTML.
 * @throws When the loader throws or returns a redirect, or the page fails to render.
 */
export async function renderPage(
  page: PageModule,
  pattern: string,
  path: string,
  options: RenderOptions = {},
): Promise<string> {
  const handler = createStaticHandler([
    {
      id: "layout",
      Component: PageLayout,
      children: [{ id: "page", path: pattern, loader: page.loader, Component: page.default }],
    },
  ])
  const headers = options.cookie ? { Cookie: options.cookie } : undefined
  const context = await handler.query(new Request(new URL(path, TEST_ORIGIN), { headers }))
  if (context instanceof Response) {
    throw new Error(`The loader of ${path} responded with ${context.status} instead of data`)
  }
  if (context.errors) {
    const error = Object.values(context.errors)[0]
    throw error instanceof Error
      ? error
      : new Error(`The loader of ${path} failed: ${JSON.stringify(error)}`)
  }
  const router = createStaticRouter(handler.dataRoutes, context)
  // Unlike `renderToString`, `prerender` waits for deferred loader data (`<Await>`) to resolve.
  const { prelude } = await prerender(
    createElement(StaticRouterProvider, { router, context, hydrate: false }),
  )
  return new Response(prelude).text()
}

interface DataWithInit {
  type: "DataWithResponseInit"
  data: unknown
  init: ResponseInit | null
}

function isDataWithInit(value: unknown): value is DataWithInit {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    value.type === "DataWithResponseInit"
  )
}
