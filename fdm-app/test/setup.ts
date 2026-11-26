/**
 * Runs before every file of the `integration` Vitest project. It replaces the session lookup of
 * the app, so loaders and actions run as the user set with `signInAs` (see `test/session.ts`).
 * Everything else, including the database, is the real app code.
 */
import { afterEach, vi } from "vitest"
import { signInAs } from "./session"

vi.mock("~/lib/auth.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/lib/auth.server")>()
  const { getTestSession } = await import("./session")
  return { ...actual, getSession: getTestSession }
})

afterEach(() => {
  signInAs(null)
})
