import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { reactRouter } from "@react-router/dev/vite"
import { sentryReactRouter } from "@sentry/react-router"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const calculatorPackagePath = path.resolve(
    __dirname,
    "../fdm-calculator/package.json",
)
const calculatorPackage = JSON.parse(
    fs.readFileSync(calculatorPackagePath, "utf-8"),
)

const replaceCalculatorVersion = {
    name: "replace-calculator-version",
    transform(code: string, id: string) {
        const cleanId = id.split("?", 1)[0]
        const target = path.join("fdm-calculator", "src", "package.ts")
        if (path.normalize(cleanId).endsWith(target)) {
            const placeholder = `"fdm-calculator:{FDM_CALCULATOR_VERSION}"`
            if (code.includes(placeholder)) {
                const replacement = `"fdm-calculator:${calculatorPackage.version}"`
                return {
                    code: code.replace(
                        placeholder,
                        replacement.padEnd(placeholder.length, " "),
                    ),
                    map: null,
                }
            }
        }
    },
}

export default defineConfig((env) => {
    const isProd = env.mode === "production"
    const enableSentry = isProd && !!process.env.SENTRY_AUTH_TOKEN

    return {
        plugins: [
            replaceCalculatorVersion,
            reactRouter(),
            tailwindcss(),
            enableSentry &&
                sentryReactRouter(
                    {
                        org: process.env.PUBLIC_SENTRY_ORG,
                        project: process.env.PUBLIC_SENTRY_PROJECT,
                        authToken: process.env.SENTRY_AUTH_TOKEN,
                        release: {
                            name: process.env.npm_package_version,
                            setCommits: {
                                auto: true,
                            },
                        },
                    },
                    env,
                ),
        ].filter(Boolean),
        define: {
            "import.meta.env.PUBLIC_APP_VERSION": JSON.stringify(
                process.env.npm_package_version,
            ),
        },
        envPrefix: "PUBLIC_",
        ssr: {
            noExternal: [
                "posthog-js",
                "posthog-js/react",
                "@geomatico/maplibre-cog-protocol",
            ],
        },
        build: {
            sourcemap: true,
            target: "baseline-widely-available",
        },
        optimizeDeps: {
            // Keep workspace packages excluded so Vite resolves them from source
            // via tsconfig path aliases — this enables live HMR without restarting
            // fdm-app when changes are made in fdm-core, fdm-calculator, etc.
            exclude: [
                "@nmi-agro/fdm-core",
                "@nmi-agro/fdm-data",
                "@nmi-agro/fdm-calculator",
                "@nmi-agro/fdm-rvo",
                "@nmi-agro/fdm-agents",
            ],
            // Pre-bundle heavy transitive deps that workspace packages pull in,
            // so they are processed once rather than on every cold dev start.
            // These need to be listed explicitly because the workspace packages
            // above are excluded from Vite's dep scanning.
            // Only include browser-compatible packages resolvable from fdm-app.
            include: [
                // From fdm-app direct deps
                "maplibre-gl",
                "recharts",
                "@react-pdf/renderer",
                // From fdm-core / fdm-calculator (browser-compatible)
                "drizzle-orm",
                "better-auth",
                "date-fns",
                "nanoid",
                "validator",
            ],
        },
        resolve: {
            tsconfigPaths: true,
        },
    }
})
