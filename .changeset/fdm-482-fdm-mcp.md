---
"@nmi-agro/fdm-mcp": patch
---

Stop installing git in the Docker base image. No dependency is fetched from a git repository anymore, so git only made the image build larger and slower. The Docker image builds again: `pnpm deploy` stopped because the build scripts of the bundled fdm-api were not allowed.

An empty `SENTRY_RELEASE` now counts as unset, so Sentry events use the package version instead of an empty release.
