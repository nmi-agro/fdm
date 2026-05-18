import { defineConfig } from "vitest/config"

export default defineConfig({
    test: {
        globalSetup: "./src/global-setup.ts",
        maxWorkers: 2,
        coverage: {
            provider: "v8",
            reporter: ["text", "json", "html"],
            exclude: [
                "**/node_modules/**",
                "**/dist/**",
                "**/turbo**",
                "**/global-setup.ts",
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
