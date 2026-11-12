---
"@nmi-agro/fdm-app": patch
---

A new account page, "AI-assistenten", explains how to connect an AI assistant to the MCP server. It starts with what the user agrees to (the assistant can change and delete data, data goes to the provider of the assistant), then guides through three steps: create an API key, copy the address, and add the connection to the assistant. claude.ai comes first; the settings for Claude Code, Codex, the OpenAI API, local models and other programs are folded away, with the real address filled in and the key placeholder marked. After the steps it gives example questions, a hint for error 401 and how to stop a connection; on large screens these sit beside the steps. The page "API-sleutels" links to it with the button "AI-assistenten koppelen"; coming from the new page, it opens the dialog for a new key at once and links back after the key is copied. Both appear only when `PUBLIC_FDM_MCP_URL` is a valid address.

Copy buttons show "Gekopieerd" with a check mark after copying and announce it to screen readers, and long commands wrap instead of scrolling. Copying a new API key now reports when the browser refuses.

A new manual chapter, "AI-assistenten koppelen (MCP)", explains how to connect Claude, OpenAI Codex and local models to the MCP server, with the risks to keep in mind. The new `{{mcpUrl}}` token (from `PUBLIC_FDM_MCP_URL`) fills in the address of the MCP server. The manual chapter about the API describes the new usage limits of the API (at most 500 fields per farm and 10 new farms per 24 hours) and the higher limit of 120 changes per minute.
