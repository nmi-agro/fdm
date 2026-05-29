import * as Sentry from "@sentry/node"
import { nodeProfilingIntegration } from "@sentry/profiling-node"

if (process.env.PUBLIC_SENTRY_DSN) {
    Sentry.init({
        dsn: process.env.PUBLIC_SENTRY_DSN,
        integrations: [nodeProfilingIntegration()],
        tracesSampleRate: Number(
            process.env.PUBLIC_SENTRY_TRACE_SAMPLE_RATE ?? 0.1,
        ),
        profileSessionSampleRate: Number(
            process.env.PUBLIC_SENTRY_PROFILE_SAMPLE_RATE ?? 0,
        ),
        profileLifecycle: "trace",
        environment: process.env.NODE_ENV ?? "development",
        release: process.env.SENTRY_RELEASE ?? process.env.npm_package_version,
        sendDefaultPii: false,
        beforeSend(event) {
            // Scrub API key material from request headers before sending to Sentry
            const headers = event.request?.headers
            if (headers && typeof headers === "object") {
                if ("authorization" in headers)
                    headers.authorization = "[Filtered]"
                if ("x-api-key" in headers) headers["x-api-key"] = "[Filtered]"
            }
            return event
        },
    })
    console.log(
        `[Sentry] Server SDK initialized (release: ${process.env.SENTRY_RELEASE ?? process.env.npm_package_version}, env: ${process.env.NODE_ENV ?? "development"})`,
    )
} else {
    console.warn(
        "[Sentry] PUBLIC_SENTRY_DSN is not set — error reporting is disabled",
    )
}
