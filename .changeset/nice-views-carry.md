---
"@nmi-agro/fdm-app": patch
---

Fix server-side errors not captured in Sentry and fix error page copy button

Server-side exceptions were silently dropped from Sentry because `instrument.server.mjs` was never loaded at runtime — the `start` script was missing `NODE_OPTIONS='--import ./instrument.server.mjs'`. As a result, `Sentry.getClient()` always returned `null` server-side, making every `captureException()` call a no-op.

- `package.json`: Add `NODE_OPTIONS='--import ./instrument.server.mjs'` to `start` and `start-dev` scripts
- `entry.server.tsx`: Add fallback `import "../instrument.server.mjs"` at the top for environments where `NODE_OPTIONS` is not set
- `instrument.server.mjs`: Add startup log confirming Sentry initialized (or warning when DSN is missing)
- `root.tsx`: Remove redundant `Sentry.captureException()` for `RouteErrorResponse` in `ErrorBoundary` — server already captures these via `reportError()`; keep capture only for client-side `Error` instances
- `entry.client.tsx`: Remove `/sentry-tunnel` route and `tunnel` config; remove `/Unexpected Server Error/` from `ignoreErrors`
- `sentry-tunnel.tsx`: Delete the tunnel route (simplification — one less failure point)
- `error.tsx`: Fix `copyStackTrace` to properly `await` the clipboard write; on failure, auto-select the error text and show a clear message that the browser blocked clipboard access
