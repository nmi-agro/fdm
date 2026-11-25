---
"@nmi-agro/fdm-app": patch
---

Read the Sentry release from `SENTRY_RELEASE` at runtime, so server and browser errors are linked to the release that the deploy uploads source maps to. Without it, the server uses `npm_package_version` and the browser the package version from the build. When the app runs with `node ./server.js`, as in the container, `npm_package_version` is not set, so set `SENTRY_RELEASE` there to give server events a release. `SENTRY_RELEASE` is documented in `.env.example`.
