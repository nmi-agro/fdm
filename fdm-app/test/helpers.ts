/**
 * Helpers for the loader and action tests of the `integration` Vitest project.
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router"
import { randomUUID } from "node:crypto"
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
