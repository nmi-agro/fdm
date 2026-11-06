/**
 * Playwright setup of fdm-app. The app runs as a production build (`node server.js`) against a
 * PostGIS database from the `POSTGRES_*` variables; `.env.e2e` holds them locally.
 *
 * Projects:
 *
 * - `screenshots`: captures the user manual's screenshots from a seeded demo farm
 *   (`pnpm screenshots`, see `app/content/manual/README.md`). It needs a real `NMI_API_KEY`.
 *
 * Shared building blocks for further projects live in `e2e/seed` (synthetic farm) and
 * `e2e/support` (magic-link sign-in, settings).
 */
import { defineConfig, devices } from "@playwright/test"
import { STORAGE_STATE_FILE } from "./e2e/screenshots/paths"
import { BASE_URL, OUTPUT_DIR, PORT } from "./e2e/support/env"

// The seed signs up the demo user with its own better-auth instance, in the test workers.
process.env.BETTER_AUTH_URL = BASE_URL

// The app runs as in production, under the product name of the screenshots. It reads the
// database, secrets and API keys from the environment of this process.
const appEnv: Record<string, string> = {
  ...(process.env as Record<string, string>),
  NODE_ENV: "production",
  PORT: String(PORT),
  PUBLIC_FDM_NAME: "MINAS2",
  PUBLIC_FDM_URL: BASE_URL,
  BETTER_AUTH_URL: BASE_URL,
  FDM_SEO_INDEXING: "false",
  // Always the KvK test environment, with the test key that KvK publishes for it: lookups then
  // return fictional test companies, never real ones.
  KVK_API_KEY: "l7xx1f2691f2520d487b902f4e0b57a0b197",
  KVK_API_BASE_URL: "https://api.kvk.nl/test/api",
}
// No e-mail, error reporting or analytics from test runs.
for (const name of ["POSTMARK_API_KEY", "SENTRY_AUTH_TOKEN", "POSTHOG_PERSONAL_API_KEY"]) {
  delete appEnv[name]
}
// Public settings are emptied rather than removed: when one is missing at runtime, the server
// falls back to the value built into the app, but the browser does not, and the page fails to
// hydrate.
for (const name of ["PUBLIC_SENTRY_DSN", "PUBLIC_POSTHOG_KEY", "PUBLIC_FDM_API_URL"]) {
  appEnv[name] = ""
}

export default defineConfig({
  testDir: "./e2e",
  tsconfig: "./e2e/tsconfig.json",
  outputDir: `${OUTPUT_DIR}/test-results`,
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
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
  projects: [
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
        storageState: STORAGE_STATE_FILE,
        // A common desktop screen; the manual scales the images down and enlarges them on click.
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 1,
        reducedMotion: "reduce",
      },
    },
  ],
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
