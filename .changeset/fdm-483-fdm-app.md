---
"@nmi-agro/fdm-app": patch
---

Read the Sentry release from `SENTRY_RELEASE` at runtime, so server and browser errors are linked to the release that the deploy uploads source maps to. Without it, the server uses the package version (which was missing when the app runs with `node ./server.js`) and the browser the package version from the build. `SENTRY_RELEASE` is documented in `.env.example`.
