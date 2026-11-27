---
"@nmi-agro/fdm-mcp": patch
---

Fix the PostHog MCP analytics. The server reads `POSTHOG_PROJECT_TOKEN` and `POSTHOG_HOST`, with `PUBLIC_POSTHOG_KEY` and `PUBLIC_POSTHOG_HOST` still accepted as fallbacks (an empty value counts as unset, and `docker-compose.yml` passes both names to the container); without a host the analytics go to the EU region (`https://eu.i.posthog.com`). `@posthog/mcp` and `posthog-node` are pinned to exact versions (1.6.0 and 6.0.4), so tool calls keep reporting the model and conversation that an assistant passes with them.
