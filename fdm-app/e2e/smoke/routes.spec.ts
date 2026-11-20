/**
 * Route crawler: visits every GET route of the app as the signed-in owner of the seeded farm.
 *
 * The routes come from the production build, so a new route is crawled without changes here.
 * Its params are filled in by `route-params.ts`; a route whose params cannot be filled in fails
 * until it gets a resolver or a skip entry with a reason.
 *
 * A page passes when it answers 200, shows no error page, and has no errors in the browser or
 * failing (5xx) requests to the app. A resource route passes when it answers below 500: called
 * without its query or body, a 4xx is the expected answer, while a loader that throws gives 500.
 */
import { expect, test } from "@playwright/test"
import { ERROR_TEXTS, guardPage } from "../support/app"
import { listAppRoutes } from "../support/routes"
import { EXPECTED_STATUS, KNOWN_ERRORS, resolveRoute, SKIP } from "./route-params"
import { readSmokeFarm } from "./smoke-farm"

const routes = listAppRoutes()

test.describe("every route", () => {
  test("has a resolver or a skip entry, and every skip entry is a route", () => {
    const patterns = new Set(routes.map((route) => route.pattern))
    const listed = [SKIP, KNOWN_ERRORS, EXPECTED_STATUS].flatMap((map) => Object.keys(map))
    const stale = listed.filter((pattern) => !patterns.has(pattern))
    expect(stale, "Remove entries of routes that no longer exist").toEqual([])
  })

  for (const route of routes) {
    test(route.pattern, async ({ page }) => {
      test.skip(!route.hasLoader && !route.page, "No loader: not a GET route")
      const resolved = resolveRoute(route.pattern, readSmokeFarm())
      if ("skip" in resolved) {
        test.skip(true, resolved.skip)
        return
      }
      if ("missing" in resolved) {
        throw new Error(
          `No value for ${resolved.missing.join(", ")} in ${route.pattern}. Add a resolver or a skip entry in e2e/smoke/route-params.ts.`,
        )
      }

      if (!route.page) {
        const response = await page.request.get(resolved.url)
        expect(response.status(), `GET ${resolved.url}`).toBeLessThan(500)
        return
      }

      const guard = await guardPage(page)
      const response = await page.goto(resolved.url, { waitUntil: "networkidle" })
      const expected = EXPECTED_STATUS[route.pattern]?.status ?? 200
      expect(response?.status(), `GET ${resolved.url}`).toBe(expected)
      // The sign-in and welcome pages themselves may stay where they are.
      if (!/^\/(signin|welcome)\b/.test(route.pattern)) {
        expect(new URL(page.url()).pathname, "The user should stay signed in").not.toMatch(
          /^\/(signin|welcome)\b/,
        )
      }
      // A page that refuses access on purpose shows the error page.
      if (expected === 200) {
        for (const text of ERROR_TEXTS) {
          await expect(page.getByText(text), "The page should not show an error").toHaveCount(0)
        }
      }
      const known = KNOWN_ERRORS[route.pattern] ?? []
      const problems = guard
        .problems()
        .filter((problem) => !known.some((k) => k.match.test(problem)))
      expect(problems, "The page should load without errors").toEqual([])
    })
  }
})
