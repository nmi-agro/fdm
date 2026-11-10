---
title: MCP server overview
sidebar_label: Overview
sidebar_position: 1
---

# MCP server

The FDM MCP server lets AI assistants work with farm data through the [Model Context Protocol](https://modelcontextprotocol.io). An assistant such as Claude, OpenAI Codex, or a local model in LM Studio or Open WebUI can look up, change and calculate farm data, as the user who owns the API key.

The server is the `fdm-mcp` package. It runs as its own service, next to the [REST API](../rest-api/overview), and contains no data logic of its own: every tool runs an operation of the REST API (`@nmi-agro/fdm-api/operations`). Validation, permissions, errors and payloads are therefore the same as in the REST API.

## Endpoint

|                 |                                                                        |
| --------------- | ---------------------------------------------------------------------- |
| Path            | `POST /mcp` on the MCP host, for example `https://mcp.example.com/mcp` |
| Transport       | Streamable HTTP, stateless, JSON responses                             |
| Protocol        | MCP 2026-07-28; clients on 2025-11-25 keep working                     |
| `GET`, `DELETE` | `405`: the server keeps no sessions or streams                         |
| Health check    | `GET /health`                                                          |

There is no stdio entry point: users never get database credentials. Clients that only speak stdio can use `mcp-remote` (see [Clients](./clients)).

## Authentication

The MCP server uses the same API keys as the REST API (see [Authentication](../rest-api/authentication)). Send the key as one of:

- `X-API-Key: <key>`
- `Authorization: Bearer <key>`

Sending both gives `400 ambiguous-api-key`. Without a valid key the server answers `401` with `WWW-Authenticate: Bearer realm="<app name>"`. A key has the rights of its user: the assistant sees and changes exactly what the user can in the web app.

Requests from web pages are accepted only from the origins in `FDM_MCP_ALLOWED_ORIGINS` (by hostname). Requests without an `Origin` header, from desktop apps, command-line clients and servers, are always accepted.

## Audit log

Changes made through the MCP server are recorded in the audit log with channel `mcp` and the id of the API key as `credential_id`, next to `app` (web app) and `api` (REST API). See [Authorization](../rest-api/authorization#audit-channel).

## Limits

Every tool call counts in the rate-limit bucket of its operation, shared with the REST API per API key: `general` (120 per minute), `write` (120), `calc` (10) or `nmi` (10). Other protocol requests, such as `tools/list`, count in `general`. A tool that covers several operations counts in the most restrictive bucket of them. When a limit is reached, a tool call returns an error result that says how many seconds to wait.

The [usage limits](../rest-api/limits-and-pagination#usage-limits) apply as well: at most 500 fields per farm and 10 new farms per user per 24 hours.

## Tool results and errors

- Tools return `structuredContent` that matches their `outputSchema`, and the same JSON as text content. The server validates every result against the schema before it sends it.
- List tools return `{ data, next_cursor, total }` with pages of 50. Pass `next_cursor` as `cursor` for the next page.
- Failures come back as a tool result with `isError: true` and a message the model can act on, for example `Field 'x' not found.`, a validation problem, or `Rate limit exceeded … Retry after 30 s.` Unexpected errors only give an error id.
- Dates are `YYYY-MM-DD`. Quantities are metric; each field description gives its unit.

## Annotations

Each tool carries annotations so that clients can decide when to ask the user for confirmation:

| Annotation        | Set on                      |
| ----------------- | --------------------------- |
| `readOnlyHint`    | tools that only read        |
| `destructiveHint` | tools that delete           |
| `idempotentHint`  | reads, updates and deletes  |
| `openWorldHint`   | tools that call the NMI API |

## Resources

Two read-only resource templates serve clients that browse context: `fdm://farms/{b_id_farm}` and `fdm://fields/{b_id_field}`. They run the same operations as `get_farm` and `get_field` and may be cached briefly by the requesting client (`cacheScope: "private"`, 30 seconds).

## Server instructions

On connect, the server gives the model instructions: look data up before changing it, find codes in the catalogues, ask the user before deleting, use `YYYY-MM-DD` and metric units, and answer in the user's language.

## Logging and analytics

Logs and Sentry record only the tool name, outcome and duration, never arguments or results. When PostHog is configured, the server sends [PostHog MCP analytics](https://posthog.com/docs/mcp-analytics) per user: the tool, client, latency, outcome, the reason the assistant gives for a call, and reports of missing tools (`get_more_tools`). Tool arguments, results and error messages are removed before events are sent.
