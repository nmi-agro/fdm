import { defineConfig } from "tsdown"

export default defineConfig({
    entry: ["src/index.ts"],
    format: "esm",
    outDir: "dist",
    dts: true,
    sourcemap: true,
    target: "node20",
    clean: true,
    outExtensions: () => ({ js: ".js", dts: ".d.ts" }),
})
