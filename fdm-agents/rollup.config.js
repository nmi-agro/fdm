import commonjs from "@rollup/plugin-commonjs"
import resolve from "@rollup/plugin-node-resolve"
import json from "@rollup/plugin-json"
import esbuild from "rollup-plugin-esbuild"
import dts from "rollup-plugin-dts"
import packageJson from "./package.json" with { type: "json" }

const isProd = process.env.NODE_ENV === "production"

const external = [
    ...Object.keys(packageJson.dependencies || {}),
    ...Object.keys(packageJson.peerDependencies || {}),
    "@nmi-agro/fdm-core",
    "@nmi-agro/fdm-calculator",
    "@nmi-agro/fdm-data",
    "zod/v4",
]

export default [
    {
        input: "src/index.ts",
        output: {
            dir: "dist",
            format: "esm",
            preserveModules: true,
            entryFileNames: "[name].js",
            sourcemap: isProd ? true : "inline",
        },
        plugins: [
            resolve({ extensions: [".ts", ".js", ".json"] }),
            commonjs(),
            json(),
            esbuild({ minify: isProd, target: "node20" }),
        ],
        external,
    },
    {
        input: "src/index.ts",
        output: {
            file: "dist/index.d.ts",
            format: "esm",
        },
        plugins: [resolve({ extensions: [".ts", ".js", ".json"] }), dts()],
        external,
    },
]
