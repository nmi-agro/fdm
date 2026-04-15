import { readFileSync } from "node:fs"
import { defineConfig } from "tsdown"

const pkg = JSON.parse(readFileSync("./package.json", "utf-8"))

const placeholder = `"fdm-calculator:{FDM_CALCULATOR_VERSION}"`
const replacement = `"fdm-calculator:${pkg.version}"`

if (replacement.length > placeholder.length) {
    console.warn(
        "⚠️ Replacement fdm-calculator version string ended up longer than the placeholder. Source map will be broken.",
    )
}

// Pad the replacement to match the placeholder length so source maps stay valid
const paddedReplacement = replacement.padEnd(placeholder.length, " ")

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
            name: "replace-calculator-version",
            renderChunk(code) {
                if (!code.includes(placeholder)) {
                    return null
                }
                return {
                    code: code.replace(placeholder, paddedReplacement),
                    map: null,
                }
            },
        },
    ],
})
