---
"@nmi-agro/fdm-api": patch
---

Return 404 for all paths that don't match a registered route, before authentication runs.

Previously, requests to non-existent paths (e.g. from bot scanners hitting `/credentials.json`) would trigger the auth middleware — including a database lookup — and generate a `console.warn` log entry with `status=401`. Now a new `createPathExistenceGuard` middleware short-circuits these requests with a 404 RFC 9457 response and a `console.debug` log, with no auth DB lookup.
