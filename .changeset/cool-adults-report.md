---
"@nmi-agro/fdm-app": patch
---

Fix AggregateError and improve Atlas stability by implementing AbortController for network requests and reducing elevation API calls from O(viewport pixels) to 9 requests per pan/zoom by sampling a 3×3 grid of points across the visible area
