---
title: Developing the MCP server
sidebar_label: Development
sidebar_position: 4
---

# Developing the MCP server

## Run locally

### 1. Build

```bash
pnpm install
pnpm turbo run build --filter=@nmi-agro/fdm-mcp
```

fdm-mcp imports the built `dist` of fdm-api and fdm-core. Build again after you change those packages.

### 2. Create an API key

Start your local web app (`cd fdm-app && pnpm dev`), open **Account** → **API-sleutels**, create a key and copy it.

### 3. Configure and start fdm-mcp

Copy `fdm-mcp/.env.example` to `fdm-mcp/.env` and set:

| Variable                                | Value                                                                                                       |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `POSTGRES_*`                            | The database of your local fdm-app.                                                                         |
| `BETTER_AUTH_SECRET`                    | Exactly the same as in fdm-app, which issues the API keys. A different secret gives `401` on every request. |
| `BETTER_AUTH_URL`, `PUBLIC_FDM_MCP_URL` | `http://localhost:6174`                                                                                     |
| `PUBLIC_FDM_NAME`                       | The name of your app, for example the one in fdm-app.                                                       |
| `NMI_API_KEY`                           | Optional: needed for nutrient advice, indicators and measure options.                                       |
| `PUBLIC_POSTHOG_KEY`                    | Leave empty: no analytics are sent.                                                                         |

```bash
cd fdm-mcp
pnpm dev               # http://localhost:6174/mcp
curl http://localhost:6174/health
```

The console logs one line per tool call (`[fdm-mcp] tool=… outcome="ok"`), without arguments or data.

### 4. Check with the MCP Inspector

```bash
npx @modelcontextprotocol/inspector
```

Choose transport "Streamable HTTP", URL `http://localhost:6174/mcp`, and add the header `X-API-Key: <key>`. Without `FDM_MCP_ALLOWED_ORIGINS`, only `localhost` origins are accepted, which includes the Inspector.

### 5. Connect Claude Desktop

Claude Desktop's "Add custom connector" connects through Anthropic's servers, as far as we know, so it cannot reach `localhost`. Connect a local server through the configuration file instead, with [`mcp-remote`](https://www.npmjs.com/package/mcp-remote) as a bridge from stdio to the HTTP endpoint.

Open **Settings → Developer → Edit Config** in Claude Desktop (`%APPDATA%\Claude\claude_desktop_config.json` on Windows, `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS) and add:

```json
{
  "mcpServers": {
    "fdm-local": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "http://localhost:6174/mcp",
        "--header",
        "X-API-Key:${FDM_API_KEY}"
      ],
      "env": { "FDM_API_KEY": "<key>" }
    }
  }
}
```

- On Windows, use `"command": "cmd"` and put `"/c", "npx"` in front of the arguments, because Claude Desktop often cannot find `npx` otherwise.
- Write the header without a space after the colon: spaces inside arguments break on Windows.
- The key is stored in this file; keep it out of repositories and shared folders.

Quit Claude Desktop completely (also from the system tray or menu bar) and start it again. The tools of `fdm-local` appear under the tools icon of the message box. Try for example:

- "Which farms do I have?" (`list_farms`)
- "Show the fields of farm X and their crops this year." (`list_fields`, `list_cultivations`)
- "Calculate the nitrogen balance of farm X for 2025." (`calculate_nitrogen_balance`)
- "Add a fertilizer application on field Y …": Claude asks for approval of the write.
- "Delete …": the assistant must ask for confirmation first, as the server instructions require.

Troubleshooting:

| Symptom                    | What to check                                                                                                                                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `401`                      | The key is wrong or revoked, or `BETTER_AUTH_SECRET` differs from fdm-app.                                                                                                                             |
| No tools in Claude Desktop | The log of the bridge: `%APPDATA%\Claude\logs\mcp-server-fdm-local.log` (Windows) or `~/Library/Logs/Claude/mcp-server-fdm-local.log` (macOS). Check that `curl http://localhost:6174/health` answers. |
| "Rate limit exceeded"      | Wait the given seconds. Local runs use the same per-key limits, counted in your database.                                                                                                              |

To test the connector flow from the manual (URL and header in "Add custom connector"), fdm-mcp must be reachable over HTTPS from the internet: use a preview deployment, or temporarily a tunnel such as `cloudflared`. A tunnel exposes your local server to the internet; requests still need a valid API key.

## Tests

```bash
cd fdm-mcp
pnpm test
```

- The `unit` project needs no database: services are mocked, and an MCP client talks to the app in process, through the full HTTP stack, on both protocol revisions.
- The `db` project (`*.db.test.ts`) needs PostgreSQL with PostGIS, configured with `POSTGRES_*`. It builds a synthetic farm through the write tools, calls every read tool and removes the farm, so real data is checked against the output schemas.

## Add a tool

Every operation of the REST API is available as an MCP tool, or listed in `EXCLUDED_OPERATIONS` (`fdm-mcp/src/tools/excluded.ts`) with a reason. A test reads the REST API's OpenAPI document and fails when an operation has neither.

1. **Operation.** Add the endpoint's logic as an operation in `fdm-api/src/operations/<resource>.ts` with `defineOperation`, and give the route its `operationId`. See the fdm-api conventions.
2. **Tool.** Add it to `fdm-mcp/src/tools/<resource>.ts`:
   - `operationTool(op, meta)` for one operation with an object result;
   - `listTool(op, meta)` for a list, with paging;
   - `scopedTool` / `scopedListTool` when operations differ only in scope (field, farm, farm group, organization). One tool with a scope argument keeps the tool list short, which helps models choose.
3. **Description.** Write it for a model that has never seen FDM: what it returns, which ids it needs and which tool finds them, units, the date format, limits, and for deletes that the model must ask the user first. Field descriptions come from the operation's schemas; improve them there.
4. **Order.** Add the tool to `TOOLS` in `fdm-mcp/src/tools/index.ts`; `tools/list` returns this order.
5. **Tests.** Cover a call with the expected service arguments, a not-found or validation error, and the annotations.

Annotations and the rate-limit bucket follow from the operation's `kind`, `bucket` and `external`; do not override them.

Or, if the operation should not be a tool, add it to `EXCLUDED_OPERATIONS` with a specific reason.

## Deploy

Build the image from the repository root and run it as its own service:

```bash
docker build -f fdm-mcp/dockerfile -t fdm-mcp .
```

It needs the same database and `BETTER_AUTH_SECRET` as the web app and REST API, plus `PUBLIC_FDM_NAME`, `PUBLIC_FDM_MCP_URL` and, optionally, `FDM_MCP_ALLOWED_ORIGINS`, `NMI_API_KEY`, `PUBLIC_POSTHOG_KEY` and `PUBLIC_SENTRY_DSN`. See `fdm-mcp/.env.example`. Responses are plain JSON, so no session affinity or streaming support is needed.
