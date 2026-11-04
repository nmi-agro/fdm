---
"@nmi-agro/fdm-app": patch
---

Fix a hydration mismatch on every page with the farm sidebar: the Labs items in the sidebar were rendered on the server before the feature flags were known and then removed by the browser, so React threw away the server-rendered page and rendered it again. The Labs items now wait until the page has loaded before showing or hiding based on the feature flags.

Gerrit is now enabled by default. Only a feature flag that explicitly turns it off for a user hides it. Without PostHog the Gerrit page no longer shows "not enabled" and accepts requests, matching the Gerrit API routes.
