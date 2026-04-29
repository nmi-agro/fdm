import { cpSync, mkdirSync } from "node:fs"
import { defineConfig } from "tsdown"

export default defineConfig({
    entry: ["src/index.ts"],
    format: "esm",
    outDir: "dist",
    dts: true,
    sourcemap: true,
    target: "node24",
    clean: true,
    outExtensions: () => ({ js: ".js", dts: ".d.ts" }),
    plugins: [
        {
            name: "copy-skills-folder",
            buildEnd() {
                try {
                    mkdirSync("dist/skills", { recursive: true })
                    cpSync("src/skills", "dist/skills", { recursive: true })
                    console.log("Copied skills folder to dist/skills")
                } catch (err) {
                    console.error("Error copying skills folder:", err)
                    throw err
                }
            },
        },
    ],
})
