---
"@nmi-agro/fdm-app": patch
---

A new account page, "AI-assistenten (MCP)", shows the address of the MCP server with a copy button and the settings per assistant (Claude, OpenAI, LM Studio, Open WebUI and other programs), with the real address filled in. The page "API-sleutels" links to it with the button "AI-assistent koppelen". Both appear only when `PUBLIC_FDM_MCP_URL` is set.

A new manual chapter, "AI-assistenten koppelen (MCP)", explains how to connect Claude, OpenAI Codex and local models to the MCP server, with the risks to keep in mind. The new `{{mcpUrl}}` token (from `PUBLIC_FDM_MCP_URL`) fills in the address of the MCP server. The manual chapter about the API describes the new usage limits of the API (at most 500 fields per farm and 10 new farms per 24 hours) and the higher limit of 120 changes per minute.
