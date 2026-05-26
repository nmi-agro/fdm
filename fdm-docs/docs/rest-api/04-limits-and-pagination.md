---
title: Limits & Pagination
sidebar_label: Limits & Pagination
sidebar_position: 4
---

# Limits & Pagination

## Body size

| Limit | Value | Error on violation |
|---|---|---|
| Maximum JSON body size | **5 MB** | `413 payload-too-large` |
| Accepted content type | `application/json` | `415 unsupported-media-type` |

Requests with a body larger than 5 MB are rejected before processing. The limit applies to all JSON endpoints, including field creation with GeoJSON geometry.

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

| Limit | Value | Error on violation |
|---|---|---|
| Maximum GeoJSON coordinate count | **10,000 per geometry** | `422 unprocessable-entity` |

The coordinate count is the total number of `[longitude, latitude]` pairs across all rings of a geometry (including holes). Simplify geometries before submission if needed.

## Rate limits

Rate limits are enforced **per API key**. Limits reset on a rolling one-minute window.

| Request category | Limit |
|---|---|
| General (all GET requests) | **120 requests / minute** |
| Write / delete (POST, PATCH, DELETE) | **30 requests / minute** |
| Calculation endpoints | **10 requests / minute** |
| Key-management endpoints | Subject to the general limit |

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

| Parameter | Default | Maximum | Description |
|---|---|---|---|
| `limit` | `50` | `200` | Number of items to return |
| `offset` | `0` | — | Number of items to skip |

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
