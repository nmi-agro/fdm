import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    globalSetup: "./src/global-setup.ts",
    setupFiles: ["./src/setup-tests.ts"],
    retry: process.env.CI ? 2 : 0,
    maxWorkers: process.env.CI ? 2 : undefined,
    isolate: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "**/node_modules/**",
        "**/dist/**",
        "**/turbo**",
        "**/global-setup.ts",
        "**/setup-tests.ts",
        "**.d.ts",
        "*.config.ts",
        "*.config.js",
      ],
    },
    testTimeout: 10000,
    hookTimeout: 10000,
    alias: {
      "@": "./src",
    },
    environment: "node",
  },
})
