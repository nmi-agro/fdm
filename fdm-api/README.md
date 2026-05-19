# fdm-api

The `fdm-api` package provides the official REST API for the [Farm Data Model (FDM)](https://github.com/nmi-agro/fdm). It gives developers programmatic access to every object in the farm data model — farms, fields, cultivations, harvests, fertilizers, soil analyses, and more — plus agronomic calculations such as nitrogen and organic-matter balances and fertilization norms.

**Who is it for?**

- Developers building third-party integrations
- Data engineers running ingestion pipelines or syncing farm records from external systems
- Research teams extracting and analysing farm data
- Anyone who wants to automate farm data operations without using the fdm-app UI

The API is built with [Hono](https://hono.dev), documented with OpenAPI 3.1, and can be deployed as a standalone service.

---

## Table of contents

- [Getting started](#getting-started)
- [Authentication](#authentication)
- [Endpoints](#endpoints)
- [Date format](#date-format)
- [Pagination](#pagination)
- [Rate limiting](#rate-limiting)
- [Error format](#error-format)
- [Local development](#local-development)
- [Deployment](#deployment)
- [Package API](#package-api)

---

## Getting started

### 1. Create an account

Sign in to fdm-app with your email address.

### 2. Obtain an API key

Go to **Settings → API Keys** and click **Create API Key**. Give it a descriptive name (e.g. `my-pipeline`).

> **Copy the key now — it is only shown once.**

API keys have the format `fdm_…`. You can create multiple keys (e.g. one per integration) and revoke them individually in **Settings → API Keys**.

### 3. Make your first request

```bash
curl https://api.yourdomain.com/farms \
  -H "X-API-Key: fdm_your_api_key"
```

Or explore every endpoint interactively at **https://api.yourdomain.com/docs**.

---

## Authentication

All endpoints (except `/docs` and `/openapi.json`) require a user-owned API key. Send it in one of two ways:

```http
# Header
X-API-Key: fdm_your_api_key

# Bearer token
Authorization: Bearer fdm_your_api_key
```

Do not supply both headers in the same request. Keys are scoped to the account that created them.

---

## Endpoints

The API covers 12 domains. See the [interactive docs](/docs) for full request/response schemas.

### Farms

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/farms` | List all farms |
| `GET` | `/farms/{b_id_farm}` | Get a farm |
| `POST` | `/farms` | Create a farm |
| `PATCH` | `/farms/{b_id_farm}` | Update a farm |
| `DELETE` | `/farms/{b_id_farm}` | Delete a farm |

### Fields

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/farms/{b_id_farm}/fields` | List fields on a farm |
| `GET` | `/fields/{b_id}` | Get a field |
| `POST` | `/fields` | Create a field |
| `PATCH` | `/fields/{b_id}` | Update a field |
| `DELETE` | `/fields/{b_id}` | Delete a field |

### Cultivations

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/fields/{b_id}/cultivations` | List cultivations on a field |
| `GET` | `/cultivations/{b_lu}` | Get a cultivation |
| `POST` | `/cultivations` | Add a cultivation |
| `PATCH` | `/cultivations/{b_lu}` | Update a cultivation |
| `DELETE` | `/cultivations/{b_lu}` | Remove a cultivation |

### Harvests

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/cultivations/{b_lu}/harvests` | List harvests for a cultivation |
| `GET` | `/harvests/{b_id_harvesting}` | Get a harvest |
| `POST` | `/harvests` | Record a harvest |
| `PATCH` | `/harvests/{b_id_harvesting}` | Update a harvest |
| `DELETE` | `/harvests/{b_id_harvesting}` | Remove a harvest |

### Fertilizers

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/farms/{b_id_farm}/fertilizers` | List fertilizers for a farm |
| `GET` | `/fertilizers/{p_id}` | Get a fertilizer |
| `GET` | `/fertilizers/catalogue` | Browse the fertilizer catalogue |
| `POST` | `/fertilizers` | Add a custom fertilizer |
| `DELETE` | `/fertilizers/{p_id}` | Remove a fertilizer |

### Fertilizer applications

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/fields/{b_id}/fertilizer-applications` | List applications on a field |
| `GET` | `/fertilizer-applications/{p_app_id}` | Get an application |
| `POST` | `/fertilizer-applications` | Record an application |
| `PATCH` | `/fertilizer-applications/{p_app_id}` | Update an application |
| `DELETE` | `/fertilizer-applications/{p_app_id}` | Remove an application |

### Soil analyses

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/fields/{b_id}/soil-analyses` | List analyses on a field |
| `GET` | `/fields/{b_id}/current-soil-data` | Get current aggregated soil data |
| `GET` | `/soil-analyses/{a_id}` | Get an analysis |
| `POST` | `/soil-analyses` | Upload an analysis |
| `PATCH` | `/soil-analyses/{a_id}` | Update an analysis |
| `DELETE` | `/soil-analyses/{a_id}` | Remove an analysis |

### Measures

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/fields/{b_id}/measures` | List measures on a field |
| `GET` | `/measures/{b_id_measure}` | Get a measure |
| `GET` | `/measures/catalogue` | Browse the measures catalogue |
| `POST` | `/measures` | Add a measure |
| `PATCH` | `/measures/{b_id_measure}` | Update a measure |
| `DELETE` | `/measures/{b_id_measure}` | Remove a measure |

### Organic certifications

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/farms/{b_id_farm}/organic-certifications` | List certifications for a farm |
| `POST` | `/organic-certifications` | Add a certification |
| `DELETE` | `/organic-certifications/{b_id_organic}` | Remove a certification |

### Derogations

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/farms/{b_id_farm}/derogations` | List derogations for a farm |
| `POST` | `/derogations` | Add a derogation |
| `DELETE` | `/derogations/{b_id_derogation}` | Remove a derogation |

### Grazing intentions

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/farms/{b_id_farm}/grazing-intentions` | List grazing intentions for a farm |
| `PUT` | `/grazing-intentions` | Set a grazing intention |
| `DELETE` | `/grazing-intentions/{b_id_farm}/{year}` | Remove a grazing intention |

### Calculations

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/farms/{b_id_farm}/calculations/nitrogen-balance` | Farm-level nitrogen balance |
| `GET` | `/fields/{b_id}/calculations/nitrogen-balance` | Field-level nitrogen balance |
| `GET` | `/farms/{b_id_farm}/calculations/organic-matter-balance` | Farm organic-matter balance |
| `GET` | `/fields/{b_id}/calculations/organic-matter-balance` | Field organic-matter balance |
| `GET` | `/fields/{b_id}/calculations/dose` | NPK dose for a field |
| `GET` | `/farms/{b_id_farm}/calculations/norms` | Fertilization norms for a farm |
| `GET` | `/fields/{b_id}/calculations/norms` | Fertilization norms for a field |

### Reference

| Path | Description |
|------|-------------|
| `/docs` | Interactive Scalar UI — try every endpoint in the browser |
| `/openapi.json` | Full OpenAPI 3.1 document — for SDK generation or import into Postman |

---

## Date format

All date fields use **YYYY-MM-DD** (e.g. `2024-03-15`). Time-of-day and timezone are not required.

---

## Pagination

List endpoints accept `limit` and `offset` query parameters and return a consistent envelope:

```http
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
| `general` | 120 req / min | Read endpoints |
| `write` | 30 req / min | Create, update, delete endpoints |
| `calc` | 10 req / min | Calculation endpoints |

When the limit is exceeded the API returns `429 Too Many Requests` with a `Retry-After` header indicating how many seconds to wait.

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
| 422 | `unprocessable-entity` | Request is valid but cannot be processed (e.g. missing coordinates) |
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
| `pnpm check-types` | TypeScript type check without emitting |

---

## Deployment

`fdm-api` is a **standalone Node.js HTTP service** that connects to the same PostgreSQL database used by `fdm-app`. It shares the same `fdm-core` library for all data access and the same Better Auth instance for API key validation.

```text
fdm-app  (e.g. app.yourdomain.com)   <- React Router, user-facing UI
fdm-api  (e.g. api.yourdomain.com)   <- Hono REST API, machine-to-machine
          |                   |
          +---- PostgreSQL ---+
```

> **Deploy order:** always deploy `fdm-app` first — it runs database migrations on startup. Once `fdm-app` is healthy, deploy `fdm-api`.

> **Shared secret:** `BETTER_AUTH_SECRET` must be identical on both services. `fdm-api` verifies API keys that were issued by `fdm-app`'s Better Auth instance.

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
| `FDM_API_ALLOWED_ORIGINS` | No | Comma-separated CORS origins — defaults to `*` (open) |
| `PORT` | No | HTTP port — Cloud Run sets this automatically (default: `8080`) |
| `NMI_API_KEY` | No | Required for NMI-powered calculation endpoints |

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
