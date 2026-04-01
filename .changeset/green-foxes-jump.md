---
"@nmi-agro/fdm-app": minor
---

Add **Gerrit** as a Labs feature — an AI-powered fertilizer application planning assistant backed by the `fdm-agents` package.

- New farm sidebar entry and dedicated route (`/farm/:b_id_farm/:calendar/gerrit`).
- **Strategy form:** Users configure planning strategies (organic, derogation, fill manure space, NH₃ reduction, nitrogen balance target, rotation-level / bouwplan).
- **Plan table:** Displays the generated fertilizer plan per field with fertilizer type icons, application method, and amounts.
- **Summary cards & norm progress bars:** Live overview of farm-level N, P, and manure norm consumption.
- **Feedback button:** Lets users rate and comment on Gerrit's output.
- **Feature flag:** Gerrit can be enabled/disabled via the `GERRIT_ENABLED` environment variable.
- **PostHog logging:** Tool usage, strategies, and additional context are logged for product analytics.
