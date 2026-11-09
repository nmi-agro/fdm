import { defineConfig } from "vitest/config"

/**
 * Test setup for fdm-app. It is separate from `vite.config.ts` so the tests run without the
 * React Router plugin or a build.
 *
 * Two projects:
 *
 * - `unit`: `*.test.ts` files next to the code in `app/`, for pure modules and stores. No
 *   database.
 * - `integration`: `*.integration.test.ts` files in `test/`, for route loaders and actions,
 *   against a PostGIS database from the `POSTGRES_*` variables (`.env.test` locally), with the
 *   session mocked. See `test/README.md`.
 *
 * End-to-end tests run with Playwright instead (`playwright.config.ts`).
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    coverage: {
      include: ["app/lib/**", "app/store/**", "app/routes/**"],
      exclude: ["app/**/*.test.ts"],
      reporter: ["text-summary", "json", "html"],
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["app/**/*.test.ts"],
          testTimeout: 30000,
          // The manual's content loader uses `import.meta.glob`. A cached transform of that
          // module does not notice a newly added Markdown file, so a new chapter would stay
          // invisible to the tests.
          fsModuleCache: false,
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          // Not in `app/routes`: every file there becomes a route.
          include: ["test/**/*.integration.test.ts"],
          globalSetup: "./test/global-setup.ts",
          setupFiles: ["./test/setup.ts"],
          // Settings the app reads when its modules load. Test values only; no external
          // services are configured, so the routes run without them.
          env: {
            PUBLIC_FDM_URL: "http://localhost",
            PUBLIC_FDM_NAME: "FDM",
            FDM_SESSION_SECRET: "integration-test-session-secret",
            BETTER_AUTH_SECRET: "integration-test-better-auth-secret",
            BETTER_AUTH_URL: "http://localhost",
          },
          // Every test creates its own user and farm, so the files can share a worker and its
          // database connection.
          isolate: false,
          maxWorkers: process.env.CI ? 2 : undefined,
          // Runs after the unit tests, as its own group: projects with different worker limits
          // cannot share a group.
          sequence: { groupOrder: 1 },
          testTimeout: 60000,
          hookTimeout: 120000,
        },
      },
    ],
  },
})
