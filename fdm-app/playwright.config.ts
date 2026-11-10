/**
 * Playwright setup of fdm-app. The app runs as a production build (`node server.js`) against an
 * empty PostGIS database from the `POSTGRES_*` variables; `.env.e2e` holds them locally.
 *
 * `E2E_SUITE` picks the suite, because the two need the app configured differently:
 *
 * - `smoke` (default, `pnpm e2e`): the route crawler and critical flows, on every pull request.
 *   External services are off: the app gets no API keys and the browser cannot reach other
 *   origins (see `e2e/support/app.ts`).
 * - `screenshots` (`pnpm screenshots`): captures the user manual's screenshots from a seeded
 *   demo farm (see `app/content/manual/README.md`). It needs a real `NMI_API_KEY`.
 *
 * Shared building blocks live in `e2e/seed` (synthetic farm) and `e2e/support` (magic-link
 * sign-in, page checks, settings).
 */
import { defineConfig, devices, type Project } from "@playwright/test"
import { STORAGE_STATE_FILE as SCREENSHOTS_STATE } from "./e2e/screenshots/paths"
import { STORAGE_STATE_FILE as SMOKE_STATE } from "./e2e/smoke/paths"
import { BASE_URL, OUTPUT_DIR, PORT } from "./e2e/support/env"

const SUITE = process.env.E2E_SUITE === "screenshots" ? "screenshots" : "smoke"

// The seed signs up its users with its own better-auth instance, in the test workers.
process.env.BETTER_AUTH_URL = BASE_URL

// The app runs as in production and reads the database, secrets and API keys from the
// environment of this process.
const appEnv: Record<string, string> = {
  ...(process.env as Record<string, string>),
  NODE_ENV: "production",
  PORT: String(PORT),
  PUBLIC_FDM_URL: BASE_URL,
  BETTER_AUTH_URL: BASE_URL,
  FDM_SEO_INDEXING: "false",
}

// No e-mail, error reporting or analytics from test runs.
const ALWAYS_OFF = ["POSTMARK_API_KEY", "SENTRY_AUTH_TOKEN", "POSTHOG_PERSONAL_API_KEY"]
// Services the smoke suite never calls: it must pass without keys and without network access.
const SMOKE_OFF = [
  "NMI_API_KEY",
  "GEMINI_API_KEY",
  "KVK_API_KEY",
  "KVK_API_BASE_URL",
  "RVO_CLIENT_ID",
  "RVO_CLIENT_NAME",
  "RVO_REDIRECT_URI",
  "RVO_PKIO_PRIVATE_KEY",
  "GCS_BUCKET_NAME",
  "GCS_SERVICE_ACCOUNT_KEY",
  "GCS_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_APPLICATION_CREDENTIALS",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "MS_CLIENT_ID",
  "PUBLIC_MAPTILER_API_KEY",
  "LANGSMITH_API_KEY",
  "LANGSMITH_TRACING",
]
// Playwright starts the web server with this process's environment plus `webServer.env`, so a
// setting is only gone when it is removed from both.
for (const name of SUITE === "smoke" ? [...ALWAYS_OFF, ...SMOKE_OFF] : ALWAYS_OFF) {
  delete appEnv[name]
  delete process.env[name]
}
// Public settings are emptied rather than removed: when one is missing at runtime, the server
// falls back to the value built into the app, but the browser does not, and the page fails to
// hydrate.
for (const name of [
  "PUBLIC_SENTRY_DSN",
  "PUBLIC_POSTHOG_KEY",
  "PUBLIC_FDM_API_URL",
  "PUBLIC_FDM_MCP_URL",
]) {
  appEnv[name] = ""
}

if (SUITE === "screenshots") {
  // The manual shows the app under the product name of the screenshots.
  appEnv.PUBLIC_FDM_NAME = "MINAS2"
  // Always the KvK test environment, with the test key that KvK publishes for it: lookups then
  // return fictional test companies, never real ones.
  appEnv.KVK_API_KEY = "l7xx1f2691f2520d487b902f4e0b57a0b197"
  appEnv.KVK_API_BASE_URL = "https://api.kvk.nl/test/api"
} else {
  appEnv.PUBLIC_FDM_NAME = "FDM"
  // OpenStreetMap needs no key; the browser cannot load its tiles in the smoke suite anyway.
  appEnv.PUBLIC_MAP_PROVIDER = "osm"
}

const smokeProjects: Project[] = [
  {
    name: "smoke-setup",
    testMatch: "smoke/smoke.setup.ts",
    // A retry would seed into a database that is no longer empty, and sign in again.
    retries: 0,
  },
  {
    name: "smoke",
    testMatch: "smoke/*.spec.ts",
    dependencies: ["smoke-setup"],
    use: { storageState: SMOKE_STATE },
  },
]

const screenshotProjects: Project[] = [
  {
    name: "screenshots-setup",
    testMatch: "screenshots/screenshots.setup.ts",
    teardown: "screenshots-teardown",
  },
  {
    name: "screenshots-teardown",
    testMatch: "screenshots/screenshots.teardown.ts",
  },
  {
    name: "screenshots",
    testMatch: "screenshots/capture.spec.ts",
    dependencies: ["screenshots-setup"],
    retries: 1,
    use: {
      storageState: SCREENSHOTS_STATE,
      // A common desktop screen; the manual scales the images down and enlarges them on click.
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
      reducedMotion: "reduce",
    },
  },
]

export default defineConfig({
  testDir: "./e2e",
  tsconfig: "./e2e/tsconfig.json",
  outputDir: `${OUTPUT_DIR}/test-results`,
  // One worker: the tests share the seeded farm and some of them change it.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: SUITE === "smoke" && process.env.CI ? 1 : 0,
  timeout: 120_000,
  expect: { timeout: 30_000 },
  reporter: process.env.CI
    ? [["list"], ["html", { outputFolder: `${OUTPUT_DIR}/report`, open: "never" }]]
    : [["list"]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: BASE_URL,
    locale: "nl-NL",
    timezoneId: "Europe/Amsterdam",
    colorScheme: "light",
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: SUITE === "screenshots" ? screenshotProjects : smokeProjects,
  webServer: {
    // Migrate and sync the catalogues, then start the production build.
    command: "node ./app/lib/fdm-migrate.server.js && node ./server.js",
    url: `${BASE_URL}/health`,
    env: appEnv,
    // The server loads its build on the first request, which can take minutes on a cold machine.
    timeout: 600_000,
    // Locally, a server that is already running is reused (see E2E_REUSE_SEED in the README).
    reuseExistingServer: !process.env.CI,
    stdout: "ignore",
    stderr: "pipe",
  },
})
