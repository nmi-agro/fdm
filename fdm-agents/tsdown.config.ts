import { cpSync, mkdirSync } from "node:fs"
import { defineConfig } from "tsdown"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))

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
                    const srcSkills = join(__dirname, "src/skills")
                    const distSkills = join(__dirname, "dist/skills")
                    mkdirSync(distSkills, { recursive: true })
                    cpSync(srcSkills, distSkills, { recursive: true })
                    console.log("Copied skills folder to dist/skills")
                } catch (err) {
                    console.error("Error copying skills folder:", err)
                    throw err
                }
            },
        },
    ],
})
