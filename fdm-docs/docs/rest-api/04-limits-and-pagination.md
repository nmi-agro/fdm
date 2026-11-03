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

Upload endpoints accept `multipart/form-data` instead of JSON, with their own limit for the whole request. The type of each file is checked from its contents, not from its name.

| Endpoint                                                        | Accepted files                    | Limit                             |
| --------------------------------------------------------------- | --------------------------------- | --------------------------------- |
| `POST /soil-analyses/{a_id}/images`                             | JPEG, PNG, WebP or HEIC photo     | **10 MB**                         |
| `POST /soil-analyses/extract`                                   | 1 to 10 lab report PDFs           | **5 MB per file, 50 MB in total** |
| `POST /farms/{b_id_farm}/fields/import/compare` and `.../apply` | `.shp`, `.shx`, `.dbf` and `.prj` | **20 MB**                         |

Lab reports uploaded with `POST /soil-analyses/extract` that are not linked to a soil analysis are kept temporarily under `soil_analysis_pending/` in the file storage. Operators should remove them with a lifecycle rule on that prefix, for example after one day.

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
| Write / delete (POST, PATCH, DELETE) | **30 requests / minute**                         |
| Calculation endpoints                | **10 requests / minute**                         |
| Endpoints that use the NMI API       | **10 requests / minute** (separate `nmi` bucket) |
| Key-management endpoints             | Subject to the general limit                     |

The `nmi` bucket covers the indicators and measure options, the nutrient advice, reading lab reports (`POST /soil-analyses/extract`), the fertilizer plans of a farm (`/farms/{b_id_farm}/fertilizer-plans`), applying a field import (it requests soil estimates for every new field) and the indicators of a farm group. These requests do not also count in the general or write bucket.

When a limit is exceeded, the API returns `429` with a `Retry-After` header indicating the number of seconds until the limit resets.

```json title="429 response — rate-limit-exceeded"
{
  "type": "https://fdm.app/api/errors/rate-limit-exceeded",
  "title": "Rate Limit Exceeded",
  "status": 429,
  "detail": "You have exceeded the rate limit of 30 write requests per minute.",
  "instance": "/api/farms",
  "error_id": "QRST-7890"
}
```

```http title="Response headers"
HTTP/1.1 429 Too Many Requests
Retry-After: 23
Content-Type: application/problem+json
```

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
