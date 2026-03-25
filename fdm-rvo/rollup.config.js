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
            target: "node20",
        }),
    ],
    external,
}
