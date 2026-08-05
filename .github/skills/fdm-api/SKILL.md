---
name: fdm-api
description: Use when working on the FDM REST API in the fdm-api package — adding or changing endpoints, writing Zod/OpenAPI route definitions, wiring route handlers to fdm-core services, shaping request and response payloads, handling API errors, pagination, timeframes, authentication by API key, rate limiting, or writing fdm-api tests. Covers the Hono + @hono/zod-openapi structure, the injectable services pattern, RFC 9457 problem details, and the API's serialization and delete conventions. Not for the fdm-core data model or schema (see the fdm-schema skill), fdm-app UI routes and loaders (see fdm-app-conventions), or agronomic calculation logic in fdm-calculator.
version: 1.0.0
user-invocable: true
argument-hint: "[explain|add-endpoint|add-resource|review|test] [target]"
license: MIT
---

`fdm-api` is a library, not a server: `createFdmApi()` returns a configured Hono app that `fdm-app` mounts, and the same app publishes its own OpenAPI document and Scalar documentation UI. Two consequences shape everything in this package. The OpenAPI document is generated from the route definitions, so a route definition that lies about its responses produces incorrect public documentation. And every data access goes through an injectable service object, so handlers never import `fdm-core` functions directly.

**Scope.** This skill owns the REST layer: routing, validation, serialization, errors and their tests. It does not own the data model (`fdm-schema` skill), the web UI (`fdm-app-conventions` skill), or calculation logic. See `.github/skills/README.md`.

## Commands

| Command | Do this |
|---|---|
| `explain [topic]` | Answer from this skill; link to `fdm-docs/docs/rest-api/` for the published contract. |
| `add-endpoint` | Add to an existing `src/routes/<resource>.ts`: schema → `createRoute` → handler → `app.openapi(...)` → tests. |
| `add-resource` | New `src/routes/<resource>.ts`, extend `FdmApiServices` and `defaultServices`, register in `app.ts`, add an OpenAPI tag, add tests. |
| `review [diff]` | Check the Conventions and Anti-patterns sections, especially error shape and services injection. |
| `test` | `cd fdm-api && pnpm test` (no database required — services are mocked). |

## Layout

```
fdm-api/src/
  index.ts        createFdmApi(), FdmApiConfig, FdmApiServices, defaultServices
  app.ts          buildApp(): middleware order, route registration, OpenAPI doc, Scalar UI
  auth.ts         API-key authentication middleware
  guards.ts       path-existence guard, body limit / media type, GeoJSON coordinate limit
  error.ts        ApiError, problemResponse(), createErrorHandler(), createNotFoundHandler()
  rate-limit.ts   rate limiting middleware
  schemas.ts      pagination, timeframe, date and problem-details schemas; response envelopes
  types.ts        ApiEnv, ApiPrincipalContext
  routes/<resource>.ts   one file per resource, exporting register<Resource>Routes()
  tests/<resource>.test.ts
```

Middleware order in `buildApp` is deliberate: CORS → `requestGuard` (media type and 5 MB body limit) → `createPathExistenceGuard` (404 before any API-key lookup, so unknown paths cost no database query) → API-key auth → routes. Preserve it.

## The services pattern

Route handlers never import `fdm-core` or `fdm-calculator` functions directly. Every data-access function is declared on the `FdmApiServices` interface in `index.ts`, wired into `defaultServices`, and reached through the `services` argument. `createFdmApi` accepts `Partial<FdmApiServices>` overrides, which is what makes the tests run without a database.

Adding an endpoint that needs a new core function therefore has three edit points in `index.ts` — the typed import, the `FdmApiServices` member, and the `defaultServices` entry — plus a per-route interface declaring only what that route file uses:

```ts
export interface FarmServices {
  /** Returns all farms visible to the authenticated principal. */
  getFarms: typeof getFarms
  // ...
}
```

Service members are typed with `typeof <coreFunction>`, so the API cannot drift from the core signature.

Functions that are intentionally not exposed stay in the file as commented-out entries with a bracketed reason, for example `// [MINERALIZATION: disabled — behind feature flag in fdm-app]`. Keep that convention rather than deleting the lines.

## Defining a route

Each resource file follows the same order: Zod schemas → `createRoute` definitions → an exported `register<Resource>Routes` containing the handlers and the `app.openapi(...)` calls.

```ts
const FarmSchema = z
  .object({
    b_id_farm: z.string(),
    b_name_farm: z.string().nullable(),
  })
  .openapi("Farm")

const getFarmRoute = createRoute({
  method: "get",
  path: "/farms/{b_id_farm}",
  tags: ["Farms"],
  summary: "Get a farm",
  description: "Returns a single farm by ID.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: { params: z.object({ b_id_farm: z.string() }) },
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
- **`.describe()` on body fields.** These become the public field documentation.
- **Every route declares `tags`, `summary`, `description` and `security`.** The tag must exist in the `tags` array in `app.ts`.
- **Spread the shared error responses**: `...commonErrorResponses` on reads, `...writeErrorResponses` on writes. Never enumerate error codes by hand.
- **Column names are the payload field names.** The API exposes `b_id_farm` and `p_app_amount` as-is; it does not rename schema columns to camelCase. See the `fdm-schema` skill for what those names mean.

### Handlers

```ts
const getFarmHandler: RouteHandler<typeof getFarmRoute> = async (c) => {
  const principal = c.get("principal") as unknown as ApiPrincipalContext
  const { b_id_farm } = c.req.valid("param")
  const farm = await services.getFarm(fdm, principal.effectivePrincipalId, b_id_farm)
  if (!farm) {
    throw new ApiError(404, "not-found", `Farm '${b_id_farm}' not found.`)
  }
  return c.json(serialiseFarm(farm), 200)
}
```

- Handlers are typed `RouteHandler<typeof theRoute>`, which ties the response type to the route definition.
- The acting principal is always `principal.effectivePrincipalId` from `c.get("principal")`, passed as the second argument to every core function. Never read a principal from the request body or a query parameter.
- Input comes from `c.req.valid("param" | "query" | "json")`, never from `c.req.param()` or raw parsing — the validated accessor is what the OpenAPI schema guarantees.
- Responses go through a `serialise<Resource>` helper so the payload shape is defined once. Dates are serialized with `serializeDate` to `YYYY-MM-DD`; the API does not expose timestamps.
- The status code passed to `c.json` must be one declared in `responses`.

### Lists, pagination and timeframes

List endpoints take `PaginationQuerySchema` (`limit` 1–200 default 50, `offset` default 0) and return `paginatedResponse(items, limit, offset)` described by `paginatedSchema(ItemSchema)`. Timeframe-aware lists use `PaginationTimeframeQuerySchema` and convert with `parseTimeframeQuery(query)` before passing the timeframe to the core function.

## Errors

All errors are [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457) problem documents with `Content-Type: application/problem+json`, produced centrally. Handlers signal failure by throwing `ApiError`:

```ts
throw new ApiError(404, "not-found", `Farm '${b_id_farm}' not found.`)
```

The slug must be one of the keys in `TITLES` in `error.ts` (`validation-failed`, `unauthorized`, `forbidden`, `not-found`, `conflict`, `payload-too-large`, `unsupported-media-type`, `unprocessable-entity`, `rate-limit-exceeded`, `service-unavailable`, `internal-error`, …). Adding a new slug means adding its title there.

`createErrorHandler` maps everything else: invalid JSON to 400, `fdm-core` permission failures to 403 (detected through the error's `cause` chain), and anything unrecognised to 500 with a generated `error_id` reported to Sentry. Because permission denials are translated centrally, handlers do not catch them.

Never build an error response by hand with `c.json({ error: ... })`, and never let a raw `fdm-core` error message reach the client.

## Authentication and limits

Requests authenticate with a user-owned API key, sent either as `X-API-Key` or as a bearer token. Supplying both is a 400 (`ambiguous-api-key`), not a silent preference. Only `/docs`, `/openapi.json` and the base path are unauthenticated.

Authorization itself is not reimplemented here: the core functions enforce it from the principal passed in, and a denial surfaces as 403. A handler that filters results by farm identifier instead of relying on the core permission check is a security bug.

Guards enforce a 5 MB body limit, `application/json` on writes, and a 10,000-coordinate ceiling on GeoJSON geometry via `assertGeoJsonCoordinates`. Rate limiting is applied per route through `rateLimitMiddleware(fdm, tier)`, where the tier is `"write"` for `POST`/`PATCH`/`PUT`/`DELETE` and `"general"` otherwise.

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

A new endpoint is expected to cover: the success path, 401 without a key, 404 for a missing resource, and validation failure for a bad body. Assert on `res.status`, the `application/problem+json` content type and the `type` slug for errors, not on prose. `tests/openapi.test.ts` guards the generated document — run it after changing any route definition.

Run with `cd fdm-api && pnpm test`.

## Adding a resource: checklist

1. `src/routes/<resource>.ts` with schemas, routes, a `<Resource>Services` interface and `register<Resource>Routes`.
2. Extend `FdmApiServices` and `defaultServices` in `index.ts` with the required core functions.
3. Register the routes in `buildApp` and add the OpenAPI tag in `app.ts`.
4. Add `src/tests/<resource>.test.ts`.
5. Update `fdm-docs/docs/rest-api/06-endpoints.md`.
6. `pnpm test` and `pnpm check-types` in `fdm-api`.
7. `pnpm changeset` — every package in the monorepo is versioned, including private ones.

## Anti-patterns

| Anti-pattern | Instead |
|---|---|
| Importing `getFarm` from `@nmi-agro/fdm-core` inside a handler | Declare it on `FdmApiServices` and call `services.getFarm` |
| `c.json({ error: "not found" }, 404)` | `throw new ApiError(404, "not-found", "...")` |
| `c.req.param("b_id")` or manual `await c.req.json()` | `c.req.valid("param")` / `c.req.valid("json")` |
| Renaming `b_id_farm` to `farmId` in a payload | Expose the schema column names unchanged |
| Inline response schema with no `.openapi("Name")` | Name every schema so the document has components |
| Listing error responses by hand per route | `...commonErrorResponses` / `...writeErrorResponses` |
| Returning a raw `Date` or ISO timestamp | `serializeDate(...)` → `YYYY-MM-DD` |
| Reading a principal id from the body or query | `c.get("principal").effectivePrincipalId` |
| Catching permission errors in a handler | Let `createErrorHandler` map them to 403 |
| An endpoint with a test only for the happy path | Cover 401, 404 and validation failure too |
