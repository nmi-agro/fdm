---
"@nmi-agro/fdm-app": patch
---

Fix a hydration mismatch on every page with the farm sidebar: the Labs items in the sidebar were rendered on the server before the feature flags were known and then removed by the browser, so React threw away the server-rendered page and rendered it again. The Labs items now wait until the page has loaded before showing or hiding based on the feature flags.
