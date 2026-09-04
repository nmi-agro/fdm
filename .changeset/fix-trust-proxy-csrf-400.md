---
"@nmi-agro/fdm-app": patch
---

Fixed all POST actions returning `400 Bad Request` in production. `fdm-app` ran behind a TLS-terminating reverse proxy without Express `trust proxy` enabled, so `react-router-serve` always saw requests as plain `http://`. Since `react-router@8.3.1` tightened its single-fetch CSRF check to compare the full request origin (instead of just the host), the mismatch between the browser's `https://` `Origin` header and the server's reconstructed `http://` origin caused every action submission — including logout — to be rejected before the route's `action` ran.

Replaced `@react-router/serve` with a small custom Express server (`server.js`) that enables `trust proxy`, strips any incoming `X-Forwarded-Host` header (which the proxy does not set) to avoid host-header injection, and otherwise serves the app the same way `react-router-serve` did.

Also hardened error handling: `getThrownStatus` now recognises better-auth's `APIError` shape (`.statusCode`, not `.status`), and `/logout` now uses better-auth's `signOut` endpoint, which does not throw when the session is already invalid and always clears the session cookie.
