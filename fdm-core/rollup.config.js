import commonjs from "@rollup/plugin-commonjs"
import resolve from "@rollup/plugin-node-resolve"
import { copy } from "fs-extra"
import esbuild from "rollup-plugin-esbuild"
import packageJson from "./package.json" with { type: "json" }

const isProd = process.env.NODE_ENV === "production"

const dependencies = [
    ...Object.keys(packageJson.dependencies || {}),
    ...Object.keys(packageJson.peerDependencies || {}),
    "fs",
    "os",
    "net",
    "tls",
    "crypto",
    "stream",
]

const external = (id) =>
    dependencies.some((dep) => id === dep || id.startsWith(`${dep}/`))

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
        resolve({ preferBuiltins: true }),
        commonjs(),
        esbuild({
            minify: isProd, // Use esbuild's minifier in production
            target: "node24",
        }),
        {
            name: "copy-migrations-folder",
            closeBundle: () => {
                return copy("src/db/migrations", "dist/db/migrations")
                    .then(() =>
                        console.log(
                            "Copied migrations folder to dist/db/migrations",
                        ),
                    )
                    .catch((err) =>
                        console.error("Error copying migrations folder:", err),
                    )
            },
        },
    ],
    external,
}
