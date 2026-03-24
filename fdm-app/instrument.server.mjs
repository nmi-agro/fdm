import { nodeProfilingIntegration } from "@sentry/profiling-node"
import * as Sentry from "@sentry/react-router"

if (process.env.PUBLIC_SENTRY_DSN) {
    Sentry.init({
        dsn: process.env.PUBLIC_SENTRY_DSN,
        integrations: [nodeProfilingIntegration()],
        tracesSampleRate: Number(
            process.env.PUBLIC_SENTRY_TRACE_SAMPLE_RATE ?? 1,
        ),
        profilesSampleRate: Number(
            process.env.PUBLIC_SENTRY_PROFILE_SAMPLE_RATE ?? 1,
        ),
        ignoreErrors: [
            /BodyStreamBuffer was aborted/,
            // Ignore expected 405 Method Not Allowed errors caused by bots/crawlers making OPTIONS requests
            /Invalid request method "OPTIONS"/,
        ],
        environment: process.env.NODE_ENV ?? "development",
        release: process.env.npm_package_version,
    })
    console.log(
        `[Sentry] Server SDK initialized (release: ${process.env.npm_package_version}, env: ${process.env.NODE_ENV ?? "development"})`,
    )
} else {
    console.warn(
        "[Sentry] PUBLIC_SENTRY_DSN is not set — server-side error reporting is disabled",
    )
}
