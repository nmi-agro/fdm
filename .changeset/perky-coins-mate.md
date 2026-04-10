---
"@nmi-agro/fdm-agents": minor
---

Refactor Gerrit agent for streaming and conversational use

- Decompose monolithic agent instruction into skill markdown files (persona, legal-norms, fertilizer-selection, organic-matter, nitrogen-management, output-format, security-boundaries); skills are composed at runtime and copied to `dist/skills/` on build
- Add `runStreamingAgent()` AsyncGenerator that emits typed `AgentStreamEvent` events (thinking_step, text_chunk, final_response, error)
- Add `generateIntentQuestions()`: Gemini Flash call that analyses the full farm context (fields, available fertilizers, strategies, additionalContext) and returns 0–3 targeted clarifying questions the agent cannot answer itself; includes `usage` metadata for PostHog tracking
- Add `gerritModels` config object selecting the Gemini model per call type (planning, followUp, intent); defaults to `gemini-3-flash-preview` for all three
