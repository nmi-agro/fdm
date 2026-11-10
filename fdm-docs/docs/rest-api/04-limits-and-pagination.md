---
title: Limits & Pagination
sidebar_label: Limits & Pagination
sidebar_position: 4
---

# Limits & Pagination

## Body size

| Limit                  | Value              | Error on violation           |
| ---------------------- | ------------------ | ---------------------------- |
| Maximum JSON body size | **5 MB**           | `413 payload-too-large`      |
| Accepted content type  | `application/json` | `415 unsupported-media-type` |

Requests with a body larger than 5 MB are rejected before processing. The limit applies to all JSON endpoints, including field creation with GeoJSON geometry. A write request without a body, such as accepting an invitation, needs no `Content-Type`.

### File uploads

Upload endpoints accept `multipart/form-data` instead of JSON, with their own limit for the whole request. The type of each file is checked from its contents, not from its name. Let your HTTP client set the `Content-Type` header: it must include the `boundary` of the parts, and a request without it returns `400`.

| Endpoint                                                               | Accepted files                    | Limit                             |
| ---------------------------------------------------------------------- | --------------------------------- | --------------------------------- |
| `POST /soil-analyses/{a_id}/images`                                    | JPEG, PNG, WebP or HEIC photo     | **10 MB**                         |
| `POST /farms/{b_id_farm}/soil-analyses/import/compare` and `.../apply` | 1 to 10 lab report PDFs           | **5 MB per file, 50 MB in total** |
| `POST /farms/{b_id_farm}/fields/import/compare` and `.../apply`        | `.shp`, `.shx`, `.dbf` and `.prj` | **20 MB**                         |

```json title="413 response — payload-too-large"
{
  "type": "https://fdm.app/api/errors/payload-too-large",
  "title": "Payload Too Large",
  "status": 413,
  "detail": "The request body exceeds the 5 MB limit.",
  "instance": "/api/farms/farm_abc123/fields",
  "error_id": "MNOP-3456"
}
```

## Geometry limits

| Limit                            | Value                   | Error on violation         |
| -------------------------------- | ----------------------- | -------------------------- |
| Maximum GeoJSON coordinate count | **10,000 per geometry** | `422 unprocessable-entity` |

The coordinate count is the total number of `[longitude, latitude]` pairs across all rings of a geometry (including holes). Simplify geometries before submission if needed.

## Rate limits

Rate limits are enforced **per API key**. Limits reset on a rolling one-minute window.

| Request category                     | Limit                                            |
| ------------------------------------ | ------------------------------------------------ |
| General (all GET requests)           | **120 requests / minute**                        |
| Write / delete (POST, PATCH, DELETE) | **120 requests / minute**                        |
| Calculation endpoints                | **10 requests / minute**                         |
| Endpoints that use the NMI API       | **10 requests / minute** (separate `nmi` bucket) |
| Key-management endpoints             | Subject to the general limit                     |

The `nmi` bucket covers the indicators and measure options, the nutrient advice, reading lab reports (`POST /farms/{b_id_farm}/soil-analyses/import/compare`), the fertilizer plans of a farm (`/farms/{b_id_farm}/fertilizer-plans`), applying a field import (it requests soil estimates for every new field) and the indicators of a farm group. These requests do not also count in the general or write bucket.

When a limit is exceeded, the API returns `429` with a `Retry-After` header indicating the number of seconds until the limit resets.

```json title="429 response — rate-limit-exceeded"
{
  "type": "https://fdm.app/api/errors/rate-limit-exceeded",
  "title": "Rate Limit Exceeded",
  "status": 429,
  "detail": "You have exceeded the rate limit of 120 write requests per minute.",
  "instance": "/api/farms",
  "error_id": "QRST-7890"
}
```

```http title="Response headers"
HTTP/1.1 429 Too Many Requests
Retry-After: 23
Content-Type: application/problem+json
```

## Usage limits

To prevent misuse, the API supports farms up to a fixed size and limits how many farms a user can create. These limits apply to the REST API and the MCP server; the web application does not have them.

| Limit              | Value                                                | Error on violation                                    |
| ------------------ | ---------------------------------------------------- | ----------------------------------------------------- |
| Fields per farm    | **500**                                              | `422 unprocessable-entity`                            |
| New farms per user | **10 per 24 hours**, across all API keys of the user | `429 rate-limit-exceeded` with a `Retry-After` header |

- **Fields per farm.** Adding a field (`POST /farms/{b_id_farm}/fields`) or applying a field import fails when the farm would have more than 500 fields. Fields that an import removes make room for the fields it adds. For a farm that already has more than 500 fields, farm-level lists and calculations fail: the fields, cultivations, harvests, fertilizer applications, measures, soil analyses and current soil data of the farm, its balances, norms, nutrient advice and indicators, and the aggregations of a farm group or organization that includes it. Requests for a single field, cultivation or other record keep working. The count includes every field that was ever linked to the farm.
- **New farms per user.** The 24 hours start at the first farm the user creates in a new window. The `Retry-After` header and the `retry_after` member of the problem document give the number of seconds until the window ends.

## Pagination

All list endpoints use **offset-based pagination** with `limit` and `offset` query parameters.

| Parameter | Default | Maximum | Description               |
| --------- | ------- | ------- | ------------------------- |
| `limit`   | `50`    | `200`   | Number of items to return |
| `offset`  | `0`     | —       | Number of items to skip   |

Every list endpoint defines a **stable default ordering** (typically by creation date ascending). Ordering is documented per endpoint.

### Example

```http title="Request — paginated farms list"
GET /api/farms?limit=25&offset=50 HTTP/1.1
Host: app.fdm.nl
X-API-Key: fdm_live_xxxxxxxxxxxxxxxxxxxx
```

```json title="Response"
{
  "data": [
    {
      "b_id_farm": "farm_abc123",
      "b_name_farm": "Hoeve De Morgen"
    }
  ],
  "pagination": {
    "limit": 25,
    "offset": 50,
    "total": 82
  }
}
```

### Timeframe filtering

List endpoints that support date filtering use ISO 8601 date strings and `start` / `end` query parameters:

```http
GET /api/farms/farm_abc123/fields?start=2024-01-01&end=2024-12-31
```

## Bulk endpoints

Bulk import/export endpoints are **out of scope** for the initial API. Future bulk endpoints will define their own item count, body size, and streaming limits before being exposed.
