---
name: fdm-mcp
description: Use when working on the MCP server in the fdm-mcp package — adding or changing MCP tools or resources, writing tool descriptions and annotations, mapping fdm-api operations to tools, keeping every fdm-api operation available as a tool, rate limits and errors of tool calls, the server instructions, PostHog MCP analytics, or writing fdm-mcp tests. Covers the stateless Streamable HTTP server, API-key auth with audit channel mcp, the tool model on top of the fdm-api operations layer, and the parity rule with its exclusion list. Not for REST endpoints or the operations themselves (see the fdm-api skill), the data model (fdm-schema), or fdm-app (fdm-app-conventions).
version: 1.0.0
user-invocable: true
argument-hint: "[explain|add-tool|review|test] [target]"
license: MIT
---

`fdm-mcp` exposes the Farm Data Model to AI assistants over the [Model Context Protocol](https://modelcontextprotocol.io). It is its own service (`src/server.ts`, own Cloud Run service and Dockerfile) and contains no data logic: every tool runs one or more **operations** from `@nmi-agro/fdm-api/operations`, the same code the REST API runs. Validation, permissions, errors and payloads are therefore identical to REST; this package only adds the MCP shape.

**Scope.** This skill owns tools, resources, the MCP HTTP endpoint, server instructions and analytics. Endpoint logic, schemas and the operations layer belong to the `fdm-api` skill. See `.claude/skills/README.md`.

## The rule: every fdm-api operation is available as a tool

Every `operationId` in the fdm-api OpenAPI document is covered by an MCP tool, **or** listed in `EXCLUDED_OPERATIONS` (`src/tools/excluded.ts`) with a reason, for example `"downloadFertilizerPlanPdf": "binary PDF download; not useful as a tool"`. A test reads the OpenAPI document and fails on an uncovered operation and on a stale exclusion. So a new REST endpoint needs a decision here in the same PR.

Keep the tool list short (about 60): long lists make models, especially small local ones, pick the wrong tool. Cover related operations with **one tool and a scope argument** instead of one tool each, for example `list_cultivations` with `b_id_field` or `b_id_farm`.

## Commands

| Command | Do this |
|---|---|
| `explain [topic]` | Answer from this skill; link to `fdm-docs/docs/mcp-server/` for the published docs. |
| `add-tool` | Operation in fdm-api (see the fdm-api skill) → tool in `src/tools/<resource>.ts` → add to `TOOLS` in `src/tools/index.ts` → tests. |
| `review [diff]` | Check the tool design rules and the anti-patterns below. |
| `test` | `cd fdm-mcp && pnpm test` (no database required). |

## Layout

```
fdm-mcp/src/
  index.ts        createFdmMcp(): Hono app with CORS, Origin check, body limit, API-key auth, /mcp, /health
  server.ts       standalone entry: env, PostHog client, port 6174
  mcp-server.ts   createMcpServer(): one McpServer per request, registers tools and resources
  call-tool.ts    runs a tool: rate limit → operation → output validation → result or isError
  tools/types.ts  McpTool, operationTool(), listTool(), annotationsFor()
  tools/<resource>.ts  the tools of one resource
  tools/index.ts  TOOLS, in the order tools/list returns them
  resources.ts    fdm://farms/{b_id_farm}, fdm://fields/{b_id_field}
  instructions.ts server instructions for the model
  analytics.ts    PostHog MCP analytics and the properties it never sends
  cursor.ts       opaque cursors, page size 50
  tests/          in-process MCP client over the full HTTP stack
```

## Request flow

`POST /mcp` → CORS → `originValidation` (allowed origins, or localhost only) → body limit (5 MB) → `createApiKeyAuth(..., { channel: "mcp", wwwAuthenticate })` → protocol rate limit (everything except `tools/call` counts in `general`) → `createMcpHandler` (stateless, `responseMode: "json"`, both protocol eras) → `createMcpServer` for the principal → `callTool`.

The principal reaches the server through `authInfo.extra.principal`; the API key itself is never passed on. Tool handlers run inside `withAuditContext`, so every change is audited with channel `mcp` and the key id.

## Tool design

```ts
operationTool(getFarm, {
  name: "get_farm",
  title: "Get a farm",
  description: "Returns one farm by its id (`b_id_farm`): name, business id and address.",
})
```

- **Name** in snake_case, verb first (`list_`, `get_`, `create_`, `update_`, `delete_`, `calculate_`, `search_`).
- **Description for the model**: what it returns, the ids it needs and where to find them, units (kg/ha, ha, kg N/ha), date format YYYY-MM-DD, and limits. Deletes say they are permanent and that the model must ask the user first.
- **Schemas** come from the operation; descriptions of every field come from fdm-api, so improve them there. List operations go through `listTool` (cursor, `{ data, next_cursor, total }`).
- **Annotations** follow from the operation's `kind` and `external` (`annotationsFor`): reads `readOnlyHint`, deletes `destructiveHint`, reads/updates/deletes `idempotentHint`, NMI-backed `openWorldHint`. Clients use them to decide when to ask for confirmation, so never override them to avoid a prompt.
- **Rate limit** comes from the operation's `bucket`, shared with REST per API key.
- **Errors** are results with `isError: true` and the operation's `ApiError` message (via `classifyError`): "Farm 'x' not found.", "Rate limit exceeded … Retry after 30 s.". Unexpected errors only give an error id. Never a protocol error for a domain failure.
- **Output** is validated against the output schema before it is sent (extra properties are dropped). A mismatch is a schema bug: fix the schema in fdm-api.
- **Never log or send arguments, results or error messages** to logs, Sentry or analytics: they contain farm data. `call-tool.ts` logs only the tool name, outcome and duration.

## Analytics

PostHog MCP analytics are on when `PUBLIC_POSTHOG_KEY` is set. Events carry `distinct_id` = user id (the same as fdm-app). Intent capture (`context` argument) and `get_more_tools` are on. `beforeSend` removes `PRIVATE_EVENT_PROPERTIES` (arguments, results, error messages) and drops `$exception` (Sentry handles errors). The injected arguments are stripped before the tool runs.

## Tests

Tests run without a database: `makeApp(services)` builds the app with mocked `fdm`, `auth` and services, and `connect(app, { era })` connects a real MCP client through `app.request`. Run tool behaviour on both eras (`ERAS`).

A new tool is covered by: a call with the expected service arguments and `structuredContent`, a not-found or validation error as `isError`, and its annotations. The parity test covers the operation mapping.

## Anti-patterns

| Anti-pattern | Instead |
|---|---|
| Data logic or `fdm-core` calls in a tool | Put it in an fdm-api operation and run that |
| A new REST endpoint without a tool or exclusion | Add a tool, or an `EXCLUDED_OPERATIONS` entry with a reason |
| One tool per near-identical operation | One tool with a scope argument |
| Throwing a protocol error for "not found" | Let the operation throw `ApiError`; `callTool` returns `isError` |
| Logging `args` or the result | Log the tool name and outcome only |
| `readOnlyHint: true` on a tool that writes | Derive annotations from the operation `kind` |
| A description without units, date format or where ids come from | Write it for a model that has never seen FDM |
