import { defineConfig } from "vitest/config"

/**
 * Test setup for fdm-app. It is separate from `vite.config.ts` so the tests run without the
 * React Router plugin, a database or a build: they only cover pure modules such as the manual.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["app/**/*.test.ts"],
    testTimeout: 30000,
    coverage: {
      include: ["app/lib/manual/**"],
    },
  },
})
