---
title: Developing the MCP server
sidebar_label: Development
sidebar_position: 4
---

# Developing the MCP server

## Run locally

```bash
cd fdm-mcp
cp .env.example .env   # the database and BETTER_AUTH_SECRET of your local fdm-app
pnpm dev               # http://localhost:6174/mcp
```

Create an API key in your local web app, then connect the [MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector):

```bash
npx @modelcontextprotocol/inspector
```

Choose transport "Streamable HTTP", URL `http://localhost:6174/mcp`, and add the header `X-API-Key: <key>`. Without `FDM_MCP_ALLOWED_ORIGINS`, only `localhost` origins are accepted, which includes the Inspector.

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
