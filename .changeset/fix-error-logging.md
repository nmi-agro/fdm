---
"@nmi-agro/fdm-app": patch
---

Fix error logging so server errors are actually captured in Sentry

Server errors were silently dropped from Sentry in several scenarios, leaving only an uninformative client-side "Unexpected Server Error" event with no stack trace or error code

- `reportError()` now always calls `Sentry.captureException()` when the SDK is initialized (guarded via `Sentry.getClient()`), removing the dependency on `clientConfig` which could silently evaluate to `null` server-side
- `errorId` is now stored in Sentry **tags** (`error_id`) in addition to `extra`, making it searchable — users can report their error code and you can find the exact event with `error_id:XXXX-XXXX`
- `console.error` is now always called in `reportError()`, regardless of whether Sentry is configured
- `"Unexpected Server Error"` is added to `ignoreErrors` on the client — this React Router shadow event is always a duplicate of the real server-side error
- `handleError` in `entry.server.tsx` now uses `reportError()` instead of raw `Sentry.captureException()`, so unhandled errors also get a trackable `errorId`
- Streaming `onError` callbacks now call `reportError()` instead of `console.error()` only
- `VITE_SENTRY_DSN`, `VITE_SENTRY_TRACE_SAMPLE_RATE`, and `VITE_SENTRY_PROFILE_SAMPLE_RATE` renamed to `PUBLIC_SENTRY_*` for consistency with the rest of the app
- Sentry server-side initialization is now conditional on `PUBLIC_SENTRY_DSN` being set; the app starts normally without Sentry configured
