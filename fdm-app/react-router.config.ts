import type { Config } from "@react-router/dev/config"
import { sentryOnBuildEnd } from "@sentry/react-router"
export default {
    ssr: true,
    buildEnd: async ({ viteConfig, reactRouterConfig, buildManifest }) => {
        if (
            process.env.SENTRY_AUTH_TOKEN !== undefined &&
            process.env.NODE_ENV === "production"
        ) {
            try {
                await sentryOnBuildEnd({
                    viteConfig,
                    reactRouterConfig,
                    buildManifest,
                })
            } catch (err) {
                console.warn(
                    "Sentry buildEnd hook failed; continuing without blocking the build.",
                    err,
                )
            }
        }
    },
} satisfies Config
