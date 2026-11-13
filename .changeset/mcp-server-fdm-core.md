---
"@nmi-agro/fdm-core": minor
---

The audit log accepts a third channel, `mcp`, for changes made through the Model Context Protocol (MCP) server for AI assistants, next to `app` and `api`. `getAuditContext` is now exported, so services can read the active audit context. No database migration is needed.
