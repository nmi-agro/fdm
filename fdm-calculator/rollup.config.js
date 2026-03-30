import commonjs from "@rollup/plugin-commonjs"
import resolve from "@rollup/plugin-node-resolve"
import esbuild from "rollup-plugin-esbuild"
import packageJson from "./package.json" with { type: "json" }

const isProd = process.env.NODE_ENV === "production"

const external = [
    ...Object.keys(packageJson.dependencies || {}),
    ...Object.keys(packageJson.peerDependencies || {}),
]

export default {
    input: "src/index.ts",
    output: {
        dir: "dist",
        format: "esm",
        preserveModules: true,
        entryFileNames: "[name].js",
        sourcemap: isProd ? true : "inline",
    },
    plugins: [
        resolve(),
        commonjs(),
        esbuild({
            minify: isProd, // Use esbuild's minifier in production
            target: "node24",
        }),

        {
            renderChunk: (code, map) => {
                const replacement = `"fdm-calculator:${packageJson.version}"`
                const placeholder = `"fdm-calculator:{FDM_CALCULATOR_VERSION}"`

                if (!code.includes(placeholder)) {
                    // Quietly return null if not found (expected for most files in preserveModules)
                    return null
                }

                if (replacement.length > placeholder.length) {
                    console.warn(
                        "⚠️ Replacement fdm-calculator version string ended up longer than the placeholder. Source map will be broken.",
                    )
                }

                return {
                    code: code.replace(
                        placeholder,
                        replacement.padEnd(placeholder.length, " "),
                    ),
                    map,
                }
            },
        },
    ],
    external,
}
