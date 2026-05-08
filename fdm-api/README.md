# fdm-api

The `fdm-api` package provides the official REST API for the [Farm Data Model (FDM)](https://github.com/nmi-agro/fdm). It is built with [Hono](https://hono.dev), documented with OpenAPI 3.1, and deployed as a standalone [Google Cloud Run](https://cloud.google.com/run) service.

## Table of contents

- [Architecture](#architecture)
- [Authentication](#authentication)
- [Endpoints](#endpoints)
- [Pagination](#pagination)
- [Rate limiting](#rate-limiting)
- [Error format](#error-format)
- [Local development](#local-development)
- [Deployment](#deployment)
- [Package API](#package-api)

---

## Architecture

`fdm-api` is a **standalone Node.js HTTP service** that connects to the same PostgreSQL database used by `fdm-app`. It shares the same `fdm-core` library for all data access and the same Better Auth instance for API key validation.

```
fdm-app  (e.g. app.yourdomain.com)   ← React Router, user-facing UI
fdm-api  (e.g. api.yourdomain.com)   ← Hono REST API, machine-to-machine
          │                   │
          └──── PostgreSQL ───┘
```

**Deploy order:** always deploy `fdm-app` first — it runs database migrations on startup. Once `fdm-app` is healthy, deploy `fdm-api`.

**Shared secret:** `BETTER_AUTH_SECRET` must be identical on both services. `fdm-api` verifies API keys that were issued by `fdm-app`'s Better Auth instance.

---

## Authentication

All endpoints (except `/docs` and `/openapi.json`) require a user-owned API key. Keys are created in `fdm-app` under **Settings → API Keys**.

Send the key in one of two ways:

```http
# Header
X-API-Key: fdm_your_api_key

# Bearer token
Authorization: Bearer fdm_your_api_key
```

Do not supply both headers in the same request.

---

## Endpoints

### Farms

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/farms` | List all farms accessible to the API key |
| `GET` | `/farms/{b_id_farm}` | Get a single farm by ID |

**Farm object**

```jsonc
{
  "b_id_farm": "abc123",
  "b_name_farm": "My Farm",
  "b_businessid_farm": "12345678",
  "b_address_farm": "Farmstreet 1",
  "b_postalcode_farm": "1234 AB"
}
```

### Fields

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/farms/{b_id_farm}/fields` | List all fields on a farm |
| `GET` | `/fields/{b_id}` | Get a single field by ID |

**Field object**

```jsonc
{
  "b_id": "field-abc",
  "b_name": "North Field",
  "b_id_farm": "abc123",
  "b_id_source": null,
  "b_geometry": { "type": "Polygon", "coordinates": [[...]] },
  "b_centroid": [5.12345, 52.12345],
  "b_area": 4.2,
  "b_perimeter": 820.5,
  "b_bufferstrip": false,
  "b_start": "2024-01-01T00:00:00Z",
  "b_end": null,
  "b_acquiring_method": "owner"
}
```

### Docs

| Path | Description |
|------|-------------|
| `/docs` | Interactive Scalar UI — try every endpoint in the browser |
| `/openapi.json` | Full OpenAPI 3.1 document — for SDK generation or import into Postman |

---

## Pagination

List endpoints accept `limit` and `offset` query parameters and return a consistent envelope:

```
GET /farms?limit=20&offset=0
```

```jsonc
{
  "data": [ /* array of items */ ],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 42
  }
}
```

---

## Rate limiting

Requests are rate-limited **per API key** within a 60-second sliding window.

| Bucket | Limit | Applied to |
|--------|-------|-----------|
| `general` | 120 req / min | All read endpoints (farms, fields) |
| `write` | 30 req / min | Write/delete endpoints (future) |
| `calc` | 10 req / min | Calculation endpoints (future) |

When the limit is exceeded the API returns `429 Too Many Requests` with a `Retry-After` header.

---

## Error format

All errors follow [RFC 9457 Problem Details](https://www.rfc-editor.org/rfc/rfc9457):

```jsonc
{
  "type": "https://api.yourdomain.com/problems/not-found",
  "title": "Not Found",
  "status": 404,
  "detail": "Farm 'xyz' does not exist or is not accessible.",
  "instance": "/farms/xyz",
  "requestId": "abc123"   // unique ID for support tracing
}
```

`Content-Type: application/problem+json` is set on all error responses.

| Status | Slug | Meaning |
|--------|------|---------|
| 400 | `validation-failed` | Invalid query parameters or request body |
| 400 | `ambiguous-api-key` | Both `X-API-Key` and `Authorization` supplied |
| 401 | `unauthorized` | Missing or invalid API key |
| 403 | `forbidden` | Valid key but insufficient access |
| 404 | `not-found` | Resource does not exist or is not visible to the key |
| 429 | `rate-limit-exceeded` | Too many requests |
| 500 | `internal-error` | Unexpected server error |

---

## Local development

### 1. Configure environment

```bash
cp .env.example .env
# Fill in POSTGRES_* and BETTER_AUTH_* values
# BETTER_AUTH_SECRET must match the value used in fdm-app
```

### 2. Start with hot reload

```bash
pnpm dev
```

`pnpm dev` runs `tsx watch src/server.ts` — TypeScript executes directly with file watching. The server restarts automatically on every change. No build step needed.

- **Interactive docs:** http://localhost:6173/docs
- **OpenAPI JSON:** http://localhost:6173/openapi.json

### 3. Other commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start with hot reload (tsx watch) |
| `pnpm build` | Compile TypeScript to `dist/` |
| `pnpm start` | Run compiled production build |
| `pnpm test` | Run Vitest test suite |

---

## Deployment

`fdm-api` ships as a Docker image built from `fdm-api/Dockerfile` (multi-stage Alpine build).

### Environment variables

See [`.env.example`](.env.example) for the full list. Key variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `POSTGRES_HOST` | Yes | PostgreSQL host |
| `POSTGRES_PORT` | Yes | PostgreSQL port (default: `5432`) |
| `POSTGRES_DB` | Yes | Database name |
| `POSTGRES_USER` | Yes | Database user |
| `POSTGRES_PASSWORD` | Yes | Database password |
| `BETTER_AUTH_SECRET` | Yes | **Must match `fdm-app`** |
| `BETTER_AUTH_URL` | Yes | Public URL of this API service |
| `PUBLIC_FDM_URL` | Yes | Public URL of this API service (used in error `type` links) |
| `FDM_API_ALLOWED_ORIGINS` | Yes | Comma-separated CORS origins (e.g. `https://app.yourdomain.com`) |
| `PORT` | No | HTTP port — Cloud Run sets this automatically (default: `8080`) |
| `NMI_API_KEY` | No | Required for calculation endpoints |

### Docker Compose (self-hosted)

The root `docker-compose.yml` runs `fdm-app`, `fdm-api`, and PostgreSQL together. `fdm-api` starts only after `fdm-app` is healthy (i.e. after migrations have run).

```bash
cp .env.example .env
docker compose up
```

### Google Cloud Run

```bash
# 1. Deploy fdm-app first (runs migrations)
gcloud run deploy fdm-app ...

# 2. Deploy fdm-api after fdm-app is healthy
gcloud run deploy fdm-api \
  --image gcr.io/your-project/fdm-api \
  --set-env-vars BETTER_AUTH_SECRET=...,BETTER_AUTH_URL=https://api.yourdomain.com,...
```

---

## Package API

`fdm-api` also exports a `createFdmApi()` factory so the Hono app can be embedded inside another framework (e.g. React Router catch-all route):

```ts
import { createFdmApi } from "@nmi-agro/fdm-api"

const app = createFdmApi(fdm, auth, {
  appName: "My App",
  appUrl: "https://app.yourdomain.com",
  basePath: "/api",               // prefix when embedded in another app
  allowedOrigins: [],             // omit CORS headers when same-origin
})
```

When running standalone (the default), omit `basePath` — it defaults to `"/"` so routes are at `/farms`, `/docs`, etc.
