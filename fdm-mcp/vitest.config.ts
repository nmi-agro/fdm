import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 30000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/tests/**", "src/server.ts"],
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/tests/**/*.test.ts"],
          exclude: ["src/tests/**/*.db.test.ts"],
        },
      },
      {
        // Runs the tools against a real PostgreSQL with PostGIS, configured with POSTGRES_* in
        // the environment (see .env.example). Checks that real data matches the output schemas.
        extends: true,
        test: {
          name: "db",
          include: ["src/tests/**/*.db.test.ts"],
          globalSetup: "./src/tests/setup-db.ts",
          testTimeout: 120000,
          hookTimeout: 300000,
        },
      },
    ],
  },
})
