---
"@nmi-agro/fdm-app": minor
---

Pages feel faster and show the blurred "Even geduld…" overlay less often:

- A navigation that takes longer than 300 ms now shows a slim progress bar at the top of the page. The blurred overlay only appears after 2 seconds, or after 500 ms when a form is submitted.
- The navigation metrics in Sentry now work: `navigation_progress.duration_ms` is recorded for every navigation that shows progress, and both metrics carry the destination page (`page`) and the source page (`from_page`) as attributes.
