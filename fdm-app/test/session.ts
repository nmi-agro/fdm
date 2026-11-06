/**
 * The signed-in user of the loader and action tests. `test/setup.ts` replaces `getSession` of
 * `~/lib/auth.server` with {@link getTestSession}, so a route sees the user set here.
 */
import type { getSession } from "~/lib/auth.server"

type FdmSession = Awaited<ReturnType<typeof getSession>>

/** The user a test acts as. */
export interface TestUser {
  id: string
  email: string
  firstname: string
  surname: string
}

let current: TestUser | null = null

/**
 * Signs in as `user` for the following route calls, or signs out with `null`.
 *
 * @param user - The user, usually from {@link seedUserWithFarm}.
 */
export function signInAs(user: TestUser | null): void {
  current = user
}

/**
 * Returns a session for the signed-in test user, in the shape of the app's `getSession`.
 *
 * @returns The session.
 * @throws A 401 `Response`, like the app, when no user is signed in.
 */
export async function getTestSession(): Promise<FdmSession> {
  if (!current) throw new Response("Unauthorized", { status: 401 })
  const now = new Date()
  const name = `${current.firstname} ${current.surname}`
  return {
    session: {
      id: `session-${current.id}`,
      token: `token-${current.id}`,
      userId: current.id,
      expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
      createdAt: now,
      updatedAt: now,
    },
    user: {
      id: current.id,
      email: current.email,
      emailVerified: true,
      name,
      firstname: current.firstname,
      surname: current.surname,
      createdAt: now,
      updatedAt: now,
    },
    userName: name,
    principal_id: current.id,
    initials: `${current.firstname[0]}${current.surname[0]}`,
  } as FdmSession
}
