import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import tsconfigPaths from "vite-tsconfig-paths"

export default defineConfig({
    plugins: [react(), tsconfigPaths()],
    test: {
        globals: true,
        environment: "jsdom",
        setupFiles: ["./app/test/setup.ts"],
        coverage: {
            provider: "v8",
            reporter: ["text", "json", "html"],
            exclude: [
                "**/node_modules/**",
                "**/build/**",
                "**/dist/**",
                "**/*.config.{ts,js}",
                "**/test/**",
                "**/*.test.{ts,tsx}",
                "**/*.spec.{ts,tsx}",
            ],
        },
        testTimeout: 10000,
        hookTimeout: 10000,
    },
})