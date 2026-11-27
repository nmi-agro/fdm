---
"@nmi-agro/fdm-mcp": patch
---

Fix the PostHog MCP analytics. The server reads `POSTHOG_PROJECT_TOKEN` and `POSTHOG_HOST`, with `PUBLIC_POSTHOG_KEY` and `PUBLIC_POSTHOG_HOST` still accepted as fallbacks. `@posthog/mcp` and `posthog-node` are pinned to exact versions (1.6.0 and 6.0.4), so tool calls keep reporting the model and conversation that an assistant passes with them.
