import { defineConfig } from "tsdown"

export default defineConfig({
    entry: ["src/index.ts", "src/types.ts", "src/utils.ts"],
    format: "esm",
    outDir: "dist",
    dts: true,
    sourcemap: true,
    target: "node24",
    clean: true,
    outExtensions: () => ({ js: ".js", dts: ".d.ts" }),
})
