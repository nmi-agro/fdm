/**
 * Signs in through the app's normal magic-link flow, without e-mail: the one-time code is read
 * from the test database. The app needs no test-only login mode for this.
 */
import type { Page } from "@playwright/test"
import postgres from "postgres"
import { databaseOptions } from "./env"

const PREFIX = "magic-link:"

/**
 * Reads the latest magic-link code for an e-mail address. better-auth stores the code in plain
 * text as `magic-link:<code>` in `fdm-authn.verification`, before it tries to send the e-mail.
 * The expiry is left to the app: `expires_at` has no time zone, so comparing it with `now()`
 * depends on the database settings.
 *
 * @param email - The e-mail address the code was requested for.
 * @returns The six-digit code.
 * @throws When no code shows up within about five seconds.
 */
export async function readMagicLinkCode(email: string): Promise<string> {
  const sql = postgres({ ...databaseOptions(), max: 1 })
  try {
    for (let attempt = 0; attempt < 20; attempt++) {
      const rows = await sql<{ identifier: string }[]>`
        select identifier
        from "fdm-authn".verification
        where identifier like 'magic-link:%'
          and value::json->>'email' = ${email}
        order by created_at desc
        limit 1`
      if (rows[0]) return String(rows[0].identifier).slice(PREFIX.length)
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
    throw new Error(`No magic-link code was stored for ${email}`)
  } finally {
    await sql.end()
  }
}

/**
 * Signs in an existing user on `page` and waits until the app shows the farm overview.
 *
 * Without a mail service the sign-in page shows an error after requesting the code; the code is
 * stored and valid all the same.
 *
 * @param page - A page whose context has the app as `baseURL`. Dismiss the cookie banner first
 *   (see {@link dismissNotices}), because it covers the sign-in form.
 * @param email - The e-mail address of the user.
 */
export async function signInWithMagicLink(page: Page, email: string): Promise<void> {
  await page.goto("/signin")
  await page.getByPlaceholder("naam@bedrijf.nl").fill(email)
  await page.getByRole("button", { name: "Aanmelden met e-mail" }).click()
  const code = await readMagicLinkCode(email)

  await page.goto("/signin/verify?redirectTo=/farm")
  await page.getByRole("textbox").fill(code)
  await page.getByRole("button", { name: "Verifiëren en aanmelden" }).click()
  await page.waitForURL((url) => url.pathname.startsWith("/farm"), { timeout: 30_000 })
}

/**
 * Marks the cookie banner as answered (cookies refused) and the latest changelog version as seen,
 * before any page of the context loads. Both are stored in local storage only.
 *
 * @param page - The page whose context should not show the notices.
 * @param changelogVersion - The latest version in `app/lib/changelog.ts`.
 */
export async function dismissNotices(page: Page, changelogVersion: string): Promise<void> {
  await page.context().addInitScript((version) => {
    localStorage.setItem("cookie_consent", JSON.stringify({ state: { consent: "no" }, version: 0 }))
    localStorage.setItem(
      "changelog-storage",
      JSON.stringify({
        state: { lastSeenVersion: version, dismissedVersion: version },
        version: 0,
      }),
    )
  }, changelogVersion)
}
