---
name: fdm-api
description: Use when working on the FDM REST API in the fdm-api package — adding or changing endpoints, writing Zod/OpenAPI route definitions, wiring route handlers to fdm-core services, shaping request and response payloads, handling API errors, pagination, timeframes, authentication by API key, rate limiting, or writing fdm-api tests. Covers the Hono + @hono/zod-openapi structure, the injectable services pattern, RFC 9457 problem details, and the API's serialization and delete conventions. Not for the fdm-core data model or schema (see the fdm-schema skill), fdm-app UI routes and loaders (see fdm-app-conventions), or agronomic calculation logic in fdm-calculator.
version: 1.1.0
user-invocable: true
argument-hint: "[explain|add-endpoint|add-resource|review|test] [target]"
license: MIT
---

`fdm-api` is a library with a thin server entry: `createFdmApi()` returns a configured Hono app, `src/server.ts` runs it as its own service, and the same app publishes its own OpenAPI document and Scalar documentation UI. Three consequences shape everything in this package. The OpenAPI document is generated from the route definitions, so a route definition that lies about its responses produces incorrect public documentation. Every data access goes through an injectable service object, so neither handlers nor operations import `fdm-core` functions directly. And the logic of an endpoint lives in an **operation** (`src/operations/`), not in the route handler, so other services can run the same logic with the same validation, permissions and errors.

**Scope.** This skill owns the REST layer: routing, validation, serialization, errors and their tests. It does not own the data model (`fdm-schema` skill), the web UI (`fdm-app-conventions` skill), or calculation logic. See `.claude/skills/README.md`.

## Commands

| Command | Do this |
|---|---|
| `explain [topic]` | Answer from this skill; link to `fdm-docs/docs/rest-api/` for the published contract. |
| `add-endpoint` | Schemas and operation in `src/operations/<resource>.ts` → `createRoute` with `operationId` → thin handler → `app.openapi(...)` → tests → MCP tool or exclusion in fdm-mcp. |
| `add-resource` | New `src/operations/<resource>.ts` and `src/routes/<resource>.ts`, export the operations from `src/operations/index.ts`, extend `FdmApiServices` and `defaultServices`, register in `app.ts`, add an OpenAPI tag, add tests. |
| `review [diff]` | Check the Conventions and Anti-patterns sections, especially error shape and services injection. |
| `test` | `cd fdm-api && pnpm test` (no database required — services are mocked). |

## Layout

```
fdm-api/src/
  index.ts        createFdmApi(), FdmApiConfig, FdmApiServices, defaultServices
  app.ts          buildApp(): middleware order, route registration, OpenAPI doc, Scalar UI
  auth.ts         API-key authentication middleware (channel and WWW-Authenticate options)
  guards.ts       path-existence guard, body limit / media type, GeoJSON coordinate limit
  error.ts        ApiError, classifyError(), problemResponse(), createErrorHandler(), createNotFoundHandler()
  rate-limit.ts   consumeRateLimit(), consumeWindow() and the rate limiting middleware
  limits.ts       usage limits against misuse: fields per farm, farms created per user per day
  schemas.ts      pagination, timeframe, date and problem-details schemas; response envelopes
  fields.ts       described field schemas shared by requests and responses (IDs, soil, harvest, fertilizer)
  types.ts        ApiEnv, ApiPrincipalContext
  operations/types.ts       defineOperation(), Operation, OperationContext, OperationKind
  operations/<resource>.ts  <Resource>Services, the resource's schemas and its operations
  operations/index.ts       public entry, published as @nmi-agro/fdm-api/operations
  routes/<resource>.ts      createRoute definitions and thin handlers, exporting register<Resource>Routes()
  routes/operation-context.ts  operationContext(c, fdm, services) for handlers
  tests/<resource>.test.ts
```

Middleware order in `buildApp` is deliberate: CORS → `requestGuard` (media type and 5 MB body limit) → `createPathExistenceGuard` (404 before any API-key lookup, so unknown paths cost no database query) → API-key auth → routes. Preserve it.

## The services pattern

Operations and route handlers never import `fdm-core` or `fdm-calculator` functions directly. Every data-access function is declared on the `FdmApiServices` interface in `index.ts`, wired into `defaultServices`, and reached through the `services` argument. `createFdmApi` accepts `Partial<FdmApiServices>` overrides, which is what makes the tests run without a database.

Adding an endpoint that needs a new core function therefore has three edit points in `index.ts` — the typed import, the `FdmApiServices` member, and the `defaultServices` entry — plus a per-resource interface, in `src/operations/<resource>.ts`, declaring only what that resource's operations use:

```ts
import type * as core from "@nmi-agro/fdm-core"

export interface FarmServices {
  /** Returns all farms visible to the authenticated principal. */
  getFarms: typeof core.getFarms
  // ...
}
```

Service members are typed with `typeof core.<coreFunction>`, so the API cannot drift from the core signature. The namespace import keeps names such as `getFarm` free for the operations.

Functions that are intentionally not exposed stay in the file as commented-out entries with a bracketed reason, for example `// [MINERALIZATION: disabled — behind feature flag in fdm-app]`. Keep that convention rather than deleting the lines.

## Operations

The logic of an endpoint lives in an operation in `src/operations/<resource>.ts`, defined with `defineOperation`. REST handlers call it, and so can other services (for example an MCP server) through `@nmi-agro/fdm-api/operations`. That keeps validation, permissions, errors and serialisation identical across them.

```ts
export const getFarm = defineOperation({
  name: "getFarm", // camelCase, unique; also the route's operationId
  kind: "read", // read | create | update | delete
  bucket: "general", // rate-limit bucket: general | write | calc | nmi
  input: FarmParamsSchema, // one flat object: path + query + body fields
  output: FarmSchema,
  run: async ({ fdm, services, principal }: OperationContext<FarmServices>, { b_id_farm }) => {
    const farm = await services.getFarm(fdm, principal.effectivePrincipalId, b_id_farm)
    if (!farm?.b_id_farm) {
      throw new ApiError(404, "not-found", `Farm '${b_id_farm}' not found.`)
    }
    return serialiseFarm(farm)
  },
})
```

- **Everything except transport goes in `run`**: service calls, existence checks, `ApiError`s, transactions, coordinate checks, timeframe parsing and serialisation. Status codes, headers (`Location`), 204 responses and `limit`/`offset` pagination stay in the route.
- **Input is one flat object** of path parameters, non-pagination query parameters and body fields, e.g. `FarmParamsSchema.extend(UpdateFarmBodySchema.shape)`. List operations return the full array; the route paginates it.
- **Deletes** return `DELETED` with `output: DeletedSchema` (`src/operations/common.ts`); the route answers 204.
- **`bucket`** matches the rate-limit tier of the route; set `external: true` when the operation calls the NMI API.
- The schemas and the `<Resource>Services` interface live in the operations file and are exported; the route imports them.
- Export new operations from `src/operations/index.ts`.
- Binary, multipart and file-download endpoints, imports, invitations and fertilizer plans have no operation; their logic stays in the route handler, and their routes still declare an `operationId`.
- **`run` expects validated input**: it does not apply `operation.input` itself. REST validates through the route schemas; another service must parse with `operation.input` (or let its framework do so) before calling `run`.

## Defining a route

Each route file follows the same order: imports of the schemas and operations → `createRoute` definitions → an exported `register<Resource>Routes` containing the handlers and the `app.openapi(...)` calls. The schemas below live in the operations file.

```ts
const FarmSchema = z
  .object({
    b_id_farm: FarmIdSchema,
    b_name_farm: z.string().nullable().describe("Farm display name. `null` when not set."),
  })
  .openapi("Farm")

const getFarmRoute = createRoute({
  operationId: getFarm.name,
  method: "get",
  path: "/farms/{b_id_farm}",
  tags: ["Farms"],
  summary: "Get a farm",
  description: "Returns a single farm by ID.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: { params: z.object({ b_id_farm: FarmIdSchema }) },
  responses: {
    200: {
      description: "The requested farm.",
      content: { "application/json": { schema: FarmSchema } },
    },
    ...commonErrorResponses,
  },
})
```

Requirements:

- **Named schemas.** Response schemas call `.openapi("Name")` so the generated document has a reusable component rather than an inline blob. Body schemas are named too (`CreateFarm`, `UpdateFarm`).
- **`.describe()` on every field.** Every field in request bodies, response schemas, query parameters and path parameters has a `.describe()`, including nested objects and array items. These become the public field documentation, so an external developer must be able to understand each field without reading the source. A good description states:
  - what the field means;
  - its **unit** for numeric quantities (e.g. `kg N/ha`, `g/kg`, `mg/kg`, `%`);
  - the allowed values or value range;
  - what `null` (or an omitted value) means, when it has a specific meaning.
- **Reuse described field schemas.** Identifiers (`FarmIdSchema`, `FieldIdSchema`, ...), soil parameters (`soilParameterShape`), harvest analysis fields (`harvestAnalysisShape`) and fertilizer composition (`fertilizerCompositionDescriptions`) live in `src/fields.ts`. Use them in path parameters, request bodies and responses so request and response stay in sync. Call `.describe()` last: a modifier such as `.nullable()` or `.optional()` applied after it can drop the description.
- **Every route declares `operationId`, `tags`, `summary`, `description` and `security`.** The `operationId` is the operation's `name`, or a unique camelCase literal for routes without an operation. The tag must exist in the `tags` array in `app.ts`.
- **Spread the shared error responses**: `...commonErrorResponses` on reads, `...writeErrorResponses` on writes. Never enumerate error codes by hand.
- **Column names are the payload field names.** The API exposes `b_id_farm` and `p_app_amount` as-is; it does not rename schema columns to camelCase. See the `fdm-schema` skill for what those names mean.

### Handlers

```ts
const getFarmHandler: RouteHandler<typeof getFarmRoute> = async (c) => {
  const params = c.req.valid("param")
  return c.json(await getFarm.run(operationContext(c, fdm, services), params), 200)
}
```

- Handlers are thin: read the validated input, call `<operation>.run(operationContext(c, fdm, services), { ...params, ...query, ...body })`, and turn the result into a response.
- Handlers are typed `RouteHandler<typeof theRoute>`, which ties the response type to the route definition.
- The acting principal is always `principal.effectivePrincipalId` from the request context (`operationContext` takes it from `c.get("principal")`), passed as the second argument to every core function. Never read a principal from the request body or a query parameter.
- Input comes from `c.req.valid("param" | "query" | "json")`, never from `c.req.param()` or raw parsing — the validated accessor is what the OpenAPI schema guarantees.
- Operations return serialised payloads (a `serialise<Resource>` helper in the operations file) so the payload shape is defined once. Dates are serialized with `serializeDate` to `YYYY-MM-DD`; the API does not expose timestamps.
- The status code passed to `c.json` must be one declared in `responses`.

### Lists, pagination and timeframes

List endpoints take `PaginationQuerySchema` (`limit` 1–200 default 50, `offset` default 0) and return `paginatedResponse(items, limit, offset)` described by `paginatedSchema(ItemSchema)`. Timeframe-aware lists use `PaginationTimeframeQuerySchema` and convert with `parseTimeframeQuery(query)` before passing the timeframe to the core function.

## Errors

All errors are [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457) problem documents with `Content-Type: application/problem+json`, produced centrally. Operations and handlers signal failure by throwing `ApiError`:

```ts
throw new ApiError(404, "not-found", `Farm '${b_id_farm}' not found.`)
```

The slug must be one of the keys in `TITLES` in `error.ts` (`validation-failed`, `unauthorized`, `forbidden`, `not-found`, `conflict`, `payload-too-large`, `unsupported-media-type`, `unprocessable-entity`, `rate-limit-exceeded`, `service-unavailable`, `internal-error`, …). Adding a new slug means adding its title there.

`createErrorHandler` maps everything else through `classifyError`: invalid JSON to 400, `fdm-core` permission failures to 403 (detected through the error's `cause` chain), and anything unrecognised to 500 with a generated `error_id` reported to Sentry. Because permission denials are translated centrally, operations and handlers do not catch them. Other services that run operations use `classifyError` too, so their errors match the REST API. It maps a Zod validation error to 400 `validation-failed`, like the REST validation hook.

Never build an error response by hand with `c.json({ error: ... })`, and never let a raw `fdm-core` error message reach the client.

## Authentication and limits

Requests authenticate with a user-owned API key, sent either as `X-API-Key` or as a bearer token. Supplying both is a 400 (`ambiguous-api-key`), not a silent preference. Only `/docs`, `/openapi.json` and the base path are unauthenticated.

Authorization itself is not reimplemented here: the core functions enforce it from the principal passed in, and a denial surfaces as 403. A handler that filters results by farm identifier instead of relying on the core permission check is a security bug.

Guards enforce a 5 MB body limit, `application/json` on writes, and a 10,000-coordinate ceiling on GeoJSON geometry via `assertGeoJsonCoordinates`. Rate limiting is applied per route through `rateLimitMiddleware(fdm, tier)`, where the tier is `"write"` for `POST`/`PATCH`/`PUT`/`DELETE` and `"general"` otherwise (`"calc"` for calculations, `"nmi"` for NMI-backed endpoints). The middleware counts through `consumeRateLimit(fdm, apiKeyId, bucket)`, which other services call directly so they share the same per-key limits. It only counts and reports: a caller must check `allowed` and refuse the request (429 or an error result, with `resetIn` seconds to wait) before calling `run`.

`createApiKeyAuth(auth, skipPaths, options)` records the audit channel (`"api"` by default) on the principal and in `withAuditContext`. `options.wwwAuthenticate` adds a `WWW-Authenticate` challenge to 401 responses for services that need one.

**Usage limits** (`src/limits.ts`, `USAGE_LIMITS`) apply to the API and the MCP server, not to the web app:

- A farm can have at most 500 fields. Operations that add fields call `assertFieldCapacity(fdm, services, b_id_farm, adding)`. Farm-level reads and calculations (lists over all fields of a farm, balances, norms, advice, indicators, aggregations) call `assertFarmSizeSupported(fdm, services, b_id_farm | b_id_farms)` first. A new farm-level operation must do the same; single-record operations don't.
- A user can create at most 10 farms per 24 hours (`consumeFarmCreation`, keyed on the user, not the key).
- Services that need these extend `LimitServices` (`countFieldsOfFarms`); tests mock it, e.g. `countFieldsOfFarms: async () => ({})`.

Deletes are hard deletes with cascade, matching `fdm-core`. The first delete returns 204, a repeat returns 404. Do not add soft-delete behaviour at this layer; see `fdm-docs/docs/rest-api/07-delete-semantics.md`.

## Tests

Tests live in `src/tests/<resource>.test.ts` and run with Vitest **without a database**: `mockFdm` and `mockAuth` are plain `vi.fn()` objects and the app is built with service overrides.

```ts
function makeApp(services: Partial<FdmApiServices> = {}) {
  return createFdmApi(mockFdm, mockAuth, config, services)
}

const res = await app.request("/farms", { headers: { "x-api-key": "k" } })
expect(res.status).toBe(200)
```

A new endpoint is expected to cover: the success path, 401 without a key, 404 for a missing resource, and validation failure for a bad body. Assert on `res.status`, the `application/problem+json` content type and the `type` slug for errors, not on prose. `tests/openapi.test.ts` guards the generated document — run it after changing any route definition. It validates the document and fails when a schema property, path parameter or query parameter has no `description`, listing every gap.

Run with `cd fdm-api && pnpm test`.

## Adding a resource: checklist

1. `src/operations/<resource>.ts` with schemas, a `<Resource>Services` interface and the operations; export them from `src/operations/index.ts`.
2. `src/routes/<resource>.ts` with routes (each with an `operationId`), thin handlers and `register<Resource>Routes`.
3. Extend `FdmApiServices` and `defaultServices` in `index.ts` with the required core functions.
4. Register the routes in `buildApp` and add the OpenAPI tag in `app.ts`.
5. Add `src/tests/<resource>.test.ts`.
6. Make every new operation available in the MCP server: a tool in `fdm-mcp/src/tools`, or an `EXCLUDED_OPERATIONS` entry with a reason (see the `fdm-mcp` skill). The fdm-mcp parity test fails otherwise.
7. Update `fdm-docs/docs/rest-api/06-endpoints.md`.
8. `pnpm test` and `pnpm check-types` in `fdm-api`, and `pnpm test` in `fdm-mcp`.
9. `pnpm changeset` — every package in the monorepo is versioned, including private ones.

## Anti-patterns

| Anti-pattern | Instead |
|---|---|
| Importing `getFarm` from `@nmi-agro/fdm-core` inside a handler or operation | Declare it on `FdmApiServices` and call `services.getFarm` |
| Endpoint logic (service calls, 404 checks, serialisation) in the route handler | Put it in an operation; the handler only reads input and writes the response |
| A route without `operationId` | Use the operation's `name`, or a unique camelCase literal |
| `c.json({ error: "not found" }, 404)` | `throw new ApiError(404, "not-found", "...")` |
| `c.req.param("b_id")` or manual `await c.req.json()` | `c.req.valid("param")` / `c.req.valid("json")` |
| Renaming `b_id_farm` to `farmId` in a payload | Expose the schema column names unchanged |
| Inline response schema with no `.openapi("Name")` | Name every schema so the document has components |
| Response schema property without `.describe()` | Describe every property, including nested objects and array items, with its unit |
| Path parameter without a description (`z.object({ b_id: z.string() })`) | Use the described identifier schemas from `src/fields.ts` |
| Listing error responses by hand per route | `...commonErrorResponses` / `...writeErrorResponses` |
| Returning a raw `Date` or ISO timestamp | `serializeDate(...)` → `YYYY-MM-DD` |
| Reading a principal id from the body or query | `c.get("principal").effectivePrincipalId` |
| Catching permission errors in a handler | Let `createErrorHandler` map them to 403 |
| An endpoint with a test only for the happy path | Cover 401, 404 and validation failure too |
