import { defineConfig } from "vitest/config"

export default defineConfig({
    test: {
        coverage: {
            provider: "v8",
            reporter: ["text", "json", "html"],
            exclude: [
                "**/node_modules/**",
                "**/dist/**",
                "**/turbo**",
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
        include: ["src/**/*.{test,spec}.?(c|m)[jt]s?(x)"],
    },
})
