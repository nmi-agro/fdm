---
title: Connecting clients
sidebar_label: Clients
sidebar_position: 3
---

# Connecting clients

Create an API key in the web app (**Account** → **API-sleutels**), one per client, so you can revoke one connection without affecting the others. In the examples, replace `https://mcp.example.com` with the address of your MCP server and `<key>` with the API key.

## Claude

### claude.ai and Claude Desktop

1. Open "Customize" → "Connectors" → "+ Add" → "Add custom connector".
2. URL: `https://mcp.example.com/mcp`.
3. Authentication: "No sign in".
4. Under "Request headers", add `X-API-Key` with the key as value.

On Claude Team or Enterprise, do not add the connector for the whole organisation with a personal key: every member would act as that user. Let each member add the connector with their own key.

### Claude Code

```bash
claude mcp add --transport http fdm https://mcp.example.com/mcp --header "X-API-Key: <key>"
```

## OpenAI

### Codex CLI and IDE

```bash
export FDM_API_KEY=<key>
codex mcp add fdm --url https://mcp.example.com/mcp --bearer-token-env-var FDM_API_KEY
```

Or in `~/.codex/config.toml`:

```toml
[mcp_servers.fdm]
url = "https://mcp.example.com/mcp"
bearer_token_env_var = "FDM_API_KEY"
```

### Responses API

```json
{
  "model": "gpt-5",
  "tools": [
    {
      "type": "mcp",
      "server_label": "fdm",
      "server_url": "https://mcp.example.com/mcp",
      "headers": { "Authorization": "Bearer <key>" },
      "require_approval": "always"
    }
  ],
  "input": "Which fields of my farm have no fertilizer application this year?"
}
```

### ChatGPT on the web

ChatGPT only connects custom MCP servers with OAuth sign-in or without authentication. OAuth sign-in is planned; until then, ChatGPT on the web cannot connect.

## Local models

### LM Studio

`mcp.json`:

```json
{
  "mcpServers": {
    "fdm": {
      "url": "https://mcp.example.com/mcp",
      "headers": { "X-API-Key": "<key>" }
    }
  }
}
```

### Open WebUI with Ollama

In the admin settings, add a tool server of type "MCP (Streamable HTTP)" with URL `https://mcp.example.com/mcp`, authentication "Bearer" and the key. Use a model that supports tool calling well. Less capable models, local or hosted, pick the wrong tool or fill in arguments wrongly more often.

### Clients that only support stdio

[`mcp-remote`](https://www.npmjs.com/package/mcp-remote) bridges stdio to the HTTP endpoint. Every request still goes through the MCP server; the client gets no database access.

```json
{
  "mcpServers": {
    "fdm": {
      "command": "npx",
      "args": ["mcp-remote", "https://mcp.example.com/mcp", "--header", "X-API-Key:${FDM_API_KEY}"],
      "env": { "FDM_API_KEY": "<key>" }
    }
  }
}
```

## Troubleshooting

| Symptom                                    | Cause                                                                                    |
| ------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `401`                                      | The key is missing, mistyped or revoked.                                                 |
| `400 ambiguous-api-key`                    | Both `X-API-Key` and `Authorization` are sent. Send one.                                 |
| `403` on connect from a browser            | The page's origin is not in `FDM_MCP_ALLOWED_ORIGINS`.                                   |
| Tool result "Rate limit exceeded" or `429` | Too many requests for this key; wait the given seconds. See [Limits](./overview#limits). |
| New tools do not show up                   | Refresh the tool list in the client, or remove and add the connection again.             |
