import { nodeProfilingIntegration } from "@sentry/profiling-node"
import * as Sentry from "@sentry/react-router"

if (process.env.PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.PUBLIC_SENTRY_DSN,
    integrations: [nodeProfilingIntegration()],
    tracesSampleRate: Number(process.env.PUBLIC_SENTRY_TRACE_SAMPLE_RATE ?? 1),
    profileSessionSampleRate: Number(process.env.PUBLIC_SENTRY_PROFILE_SAMPLE_RATE ?? 1),
    profileLifecycle: "trace",
    ignoreErrors: [/BodyStreamBuffer was aborted/],
    // Drop React Router's internal 404/405 responses (unmatched routes or unsupported methods).
    // These come from bots/scanners and are already logged as a debug line in `handleError`.
    // Mirrors `isInternalRouterNoise` in `app/lib/error.ts`.
    beforeSend(event, hint) {
      const error = hint.originalException
      if (
        typeof error === "object" &&
        error !== null &&
        "internal" in error &&
        error.internal === true &&
        "status" in error &&
        (error.status === 404 || error.status === 405)
      ) {
        return null
      }
      return event
    },
    environment: process.env.NODE_ENV ?? "development",
    release: process.env.npm_package_version,
    dataCollection: {
      userInfo: true,
      cookies: true,
      httpHeaders: {
        request: { deny: ["forwarded", "-ip", "remote-", "via", "-user"] },
        response: { deny: ["forwarded", "-ip", "remote-", "via", "-user"] },
      },
      httpBodies: [],
      urlQueryParams: { deny: ["forwarded", "-ip", "remote-", "via", "-user"] },
      genAI: { inputs: false, outputs: false },
      databaseQueryData: false,
      graphQL: { document: false, variables: false },
    },
  })
  console.log(
    `[Sentry] Server SDK initialized (release: ${process.env.npm_package_version}, env: ${process.env.NODE_ENV ?? "development"})`,
  )
} else {
  console.warn("[Sentry] PUBLIC_SENTRY_DSN is not set — server-side error reporting is disabled")
}
