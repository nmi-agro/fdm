# fdm-mcp

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server for the Farm Data Model. AI assistants such as Claude, OpenAI Codex, and local models in LM Studio or Open WebUI can use it to read and change farm data and run calculations, as the user who owns the API key.

fdm-mcp runs as its own service, next to the REST API (`fdm-api`). It uses the same operations as the REST API, published by fdm-api as `@nmi-agro/fdm-api/operations`, so validation, permissions, errors and payloads are the same.

## How it works

- **Endpoint**: `POST /mcp`, Streamable HTTP, stateless (MCP spec 2026-07-28; clients on 2025-11-25 keep working). There is no stdio entry point: users never get database credentials.
- **Authentication**: the same API keys as the REST API, sent as `X-API-Key: <key>` or `Authorization: Bearer <key>`. Without a valid key the server answers `401` with `WWW-Authenticate: Bearer`.
- **Audit**: changes are recorded in the audit log with channel `mcp` and the API key id.
- **Rate limits**: each tool call counts in the bucket of its operation (`general`, `write`, `calc` or `nmi`), shared with the REST API per API key. Other protocol requests count as `general`. Usage limits also apply: at most 500 fields per farm and 10 new farms per user per 24 hours.
- **Origin**: requests from web pages are only accepted from `FDM_MCP_ALLOWED_ORIGINS`. Requests without an `Origin` header are always accepted.
- **Tools**: every tool has a title, a description for the model, an input and an output schema, and annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`) so clients ask before changes. Lists return pages of 50 with a `next_cursor`. Failures come back as a tool result with `isError: true` and a message the model can act on.
- **Resources**: `fdm://farms/{b_id_farm}` and `fdm://fields/{b_id_field}`.
- **Privacy**: logs record the tool name, outcome and duration, never tool arguments or results. An unexpected failure is logged and sent to Sentry with its error and stack trace, which can contain values of the failed call. PostHog MCP analytics (optional) record the tool, client, latency, outcome and the assistant's stated intent per user, never tool arguments, results or error messages. The intent is free text from the assistant and is sent unfiltered, so it can contain names that the conversation mentions.

## Local development

```bash
cp .env.example .env        # fill in the database and BETTER_AUTH_SECRET of your local fdm-app
pnpm dev                    # http://localhost:6174/mcp
```

Create an API key in your local fdm-app (**Account** → **API-sleutels**), then connect with the [MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector):

```bash
npx @modelcontextprotocol/inspector
```

Choose transport "Streamable HTTP", URL `http://localhost:6174/mcp`, and add the header `X-API-Key: <key>`.

Or connect Claude Code:

```bash
claude mcp add --transport http fdm-local http://localhost:6174/mcp --header "X-API-Key: <key>"
```

## Tests

```bash
pnpm test
```

`@nmi-agro/fdm-api` and `@nmi-agro/fdm-core` are imported from their built `dist`, so build them first in a fresh checkout (`pnpm build` in the repository root), or run `pnpm turbo run test --filter=@nmi-agro/fdm-mcp`, which builds them for you.

The tests need no database: services are mocked, and an MCP client talks to the app in process, through the full HTTP stack, on both protocol revisions.

## Deployment

Build the image from the repository root:

```bash
docker build -f fdm-mcp/dockerfile -t fdm-mcp .
```

Run it as its own service, for example on Google Cloud Run, with the environment variables in [`.env.example`](./.env.example). It shares the database and `BETTER_AUTH_SECRET` with fdm-app and fdm-api. Responses are plain JSON, so no session affinity or streaming support is needed; set the request timeout high enough for the slowest NMI-backed tool.

`docker-compose.yml` in the repository root includes an `fdm-mcp` service on port 8081.
