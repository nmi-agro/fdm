import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { reactRouter } from "@react-router/dev/vite"
import { sentryReactRouter } from "@sentry/react-router"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"
import tsconfigPaths from "vite-tsconfig-paths"

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
            tsconfigPaths(),
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
            exclude: [
                "@nmi-agro/fdm-core",
                "@nmi-agro/fdm-data",
                "@nmi-agro/fdm-calculator",
                "@nmi-agro/fdm-rvo",
            ],
        },
    }
})
