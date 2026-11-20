---
"@nmi-agro/fdm-mcp": patch
---

Update `posthog-node` to version 6. Analytics events are now sent to the PostHog capture v1 endpoints, so a reverse proxy in front of PostHog must forward `/i/v1/analytics/events` and `/i/v1/ai/events`.
