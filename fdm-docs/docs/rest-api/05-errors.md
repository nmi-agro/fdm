---
title: Errors
sidebar_label: Errors
sidebar_position: 5
---

# Errors

All API errors use [RFC 7807 Problem Details](https://datatracker.ietf.org/doc/html/rfc7807) with the content type `application/problem+json`.

## Error response shape

```json title="Error response structure"
{
  "type": "https://fdm.app/api/errors/<slug>",
  "title": "Human-readable title",
  "status": 400,
  "detail": "A specific description of what went wrong.",
  "instance": "/api/farms/farm_abc123",
  "error_id": "ABCD-1234",
  "errors": [{ "field": "limit", "message": "Must be between 1 and 200." }]
}
```

| Field      | Description                                                                                    |
| ---------- | ---------------------------------------------------------------------------------------------- |
| `type`     | URI identifying the error class. Always a stable `https://fdm.app/api/errors/<slug>` URL.      |
| `title`    | Short human-readable title for the error class.                                                |
| `status`   | HTTP status code.                                                                              |
| `detail`   | Specific description of this occurrence of the error.                                          |
| `instance` | The API path that produced the error.                                                          |
| `error_id` | Unique correlation identifier for this error occurrence. Include this when contacting support. |
| `errors`   | _(Optional)_ Array of field-level validation errors. Present on `400` and `422` responses.     |

## Error catalog

| HTTP status | Slug                     | When it occurs                                                          |
| ----------- | ------------------------ | ----------------------------------------------------------------------- |
| `400`       | `validation-failed`      | Invalid query parameters, missing required fields, malformed body       |
| `400`       | `ambiguous-api-key`      | Both `X-API-Key` and `Authorization: Bearer` are present                |
| `401`       | `unauthorized`           | Missing, malformed, revoked, or expired API key                         |
| `403`       | `forbidden`              | Valid key, but the owning user does not have access to the resource     |
| `404`       | `not-found`              | Resource does not exist or is not visible to the requesting user        |
| `409`       | `conflict`               | Duplicate, conflicting state, or invalid state transition               |
| `413`       | `payload-too-large`      | Request body exceeds 5 MB                                               |
| `415`       | `unsupported-media-type` | Content-Type is not `application/json`                                  |
| `422`       | `unprocessable-entity`   | Semantically invalid FDM payload (e.g., date ordering, geometry errors) |
| `429`       | `rate-limit-exceeded`    | Per-key rate limit exceeded                                             |
| `500`       | `internal-error`         | Unexpected server error — always includes a safe `error_id` for support |

## Examples

### Validation error (400)

```json
{
  "type": "https://fdm.app/api/errors/validation-failed",
  "title": "Validation Failed",
  "status": 400,
  "detail": "One or more fields failed validation.",
  "instance": "/api/farms",
  "error_id": "ABCD-1234",
  "errors": [{ "field": "limit", "message": "Must be between 1 and 200." }]
}
```

### Not found (404)

```json
{
  "type": "https://fdm.app/api/errors/not-found",
  "title": "Not Found",
  "status": 404,
  "detail": "Farm 'farm_abc123' does not exist or you do not have access to it.",
  "instance": "/api/farms/farm_abc123",
  "error_id": "EFGH-5678"
}
```

### Internal error (500)

```json
{
  "type": "https://fdm.app/api/errors/internal-error",
  "title": "Internal Server Error",
  "status": 500,
  "detail": "An unexpected error occurred. Please contact support with the error_id.",
  "instance": "/api/farms",
  "error_id": "IJKL-9012"
}
```

:::info

The `500` response never includes internal stack traces, database error messages, or any information that could assist in exploiting the system. Only the `error_id` is included so support staff can look up the full error in server logs.

:::

## Do not retry on 4xx

`4xx` errors indicate a problem with the request itself. Retrying without fixing the request will produce the same error. The only retryable error class is `429` — wait for the `Retry-After` interval before retrying.
