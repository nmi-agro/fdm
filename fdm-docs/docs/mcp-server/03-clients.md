---
title: Connecting clients
sidebar_label: Clients
sidebar_position: 3
---

# Connecting clients

Create an API key in the web app (**Account** → **API-sleutels**), one per client, so you can revoke one connection without affecting the others. The page **Account** → **AI-assistenten** in the web app shows the address of the MCP server and these settings per client, ready to copy. It leads with claude.ai and folds the settings for command-line tools, the OpenAI API and local models under **Voor ontwikkelaars en lokale modellen**. In the examples, replace `https://mcp.example.com` with the address of your MCP server and `<key>` with the API key.

## Claude

### claude.ai and Claude Desktop

1. Open "Customize" → "Connectors" → "+ Add" → "Add custom connector".
2. URL: `https://mcp.example.com/mcp`.
3. Authentication: "No sign in".
4. Under "Request headers", add `X-API-Key` with the key as value.

These connectors connect from Anthropic's cloud, so they cannot reach an MCP server on `localhost`, such as the default of the Docker Compose setup. To try a local server, use Claude Code, a local model or a publicly reachable address.

On Claude Team and Enterprise, only owners and administrators can add a custom connector, and its request headers are the same for every member who uses it. A connector with one API key would let every member act as that key's user, so do not set one up. Until OAuth sign-in is available, members connect with their own key through Claude Code or through Claude Desktop with a local configuration (see [Clients that only support stdio](#clients-that-only-support-stdio)).

### Claude Code

```bash
export FDM_API_KEY=<key>
claude mcp add --transport http fdm https://mcp.example.com/mcp --header 'X-API-Key: ${FDM_API_KEY}'
```

The single quotes keep the key out of the shell history and the stored configuration: Claude Code stores the reference and expands `${FDM_API_KEY}` when it starts, so the variable must be set in the environment Claude Code runs in.

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

Codex stores only the name of the variable and reads its value when it runs, so `FDM_API_KEY` must be available to the Codex process, also when you start Codex from an IDE rather than the shell where you exported it.

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

With `require_approval: "always"`, the response contains an `mcp_approval_request` instead of running the tool. The tool runs after your application sends an `mcp_approval_response` with `approve: true` and the request's `approval_request_id` in a follow-up request. See "Approvals" in the [OpenAI guide to MCP and connectors](https://developers.openai.com/api/docs/guides/tools-connectors-mcp).

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

[`mcp-remote`](https://www.npmjs.com/package/mcp-remote) bridges stdio to the HTTP endpoint. Add it to the client's configuration file, for example `claude_desktop_config.json` of Claude Desktop, and adapt it to your client. Every request still goes through the MCP server; the client gets no database access. `mcp-remote` replaces `${FDM_API_KEY}` with the value from `env` itself, so the key does not appear in the process arguments.

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
