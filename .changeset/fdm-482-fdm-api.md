---
"@nmi-agro/fdm-api": minor
---

Add `GET /health`, a liveness check for container healthchecks. It needs no API key, does not touch the database and returns `{"status":"ok"}`. The healthcheck of fdm-api in `docker-compose.yml` already called this path, so the container is now reported as healthy instead of unhealthy.

Stop installing git in the Docker base image. No dependency is fetched from a git repository anymore, so git only made the image build larger and slower.

An empty `SENTRY_RELEASE` now counts as unset, so Sentry events use the package version instead of an empty release.
