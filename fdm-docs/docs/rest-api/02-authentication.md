---
title: Authentication
sidebar_label: Authentication
sidebar_position: 2
---

# Authentication

The FDM REST API uses **user-owned API keys** managed through the Developer Settings page in the FDM application. API keys are issued per user and inherit the effective FDM access of the user who owns them.

## Creating an API key

1. Navigate to **Account → Developer Settings → API Keys**.
2. Click **Create API key** and give the key a name.
3. Copy the raw key immediately — it is shown **only once** and cannot be retrieved afterwards.
4. Store the key securely (e.g., a secrets manager or environment variable). Never commit it to source control.

## Supported authentication headers

Every API request must include exactly one of the following authentication headers.

### `X-API-Key` header

```http
GET /api/farms HTTP/1.1
Host: app.fdm.nl
X-API-Key: fdm_live_xxxxxxxxxxxxxxxxxxxx
```

### `Authorization: Bearer` header

```http
GET /api/farms HTTP/1.1
Host: app.fdm.nl
Authorization: Bearer fdm_live_xxxxxxxxxxxxxxxxxxxx
```

### Ambiguous requests

If a request includes **both** `X-API-Key` and `Authorization: Bearer`, it is rejected with `400 ambiguous-api-key`. This avoids accidental use of the wrong credential.

```json title="400 response — ambiguous-api-key"
{
  "type": "https://fdm.app/api/errors/ambiguous-api-key",
  "title": "Ambiguous API Key",
  "status": 400,
  "detail": "Both X-API-Key and Authorization: Bearer headers are present. Include only one.",
  "instance": "/api/farms",
  "error_id": "ABCD-1234"
}
```

## Error responses for failed authentication

| Condition                | HTTP status | Error type     |
| ------------------------ | ----------- | -------------- |
| No authentication header | `401`       | `unauthorized` |
| Malformed key            | `401`       | `unauthorized` |
| Unknown key              | `401`       | `unauthorized` |
| Revoked key              | `401`       | `unauthorized` |
| Expired key              | `401`       | `unauthorized` |

All authentication errors return `application/problem+json`. Raw error details are never included to prevent key enumeration.

```json title="401 response — unauthorized"
{
  "type": "https://fdm.app/api/errors/unauthorized",
  "title": "Unauthorized",
  "status": 401,
  "detail": "The provided API key is missing, invalid, revoked, or expired.",
  "instance": "/api/farms",
  "error_id": "EFGH-5678"
}
```

## Key lifecycle

| State       | Behaviour                                           |
| ----------- | --------------------------------------------------- |
| **Active**  | Authenticates requests normally                     |
| **Revoked** | All requests with this key return `401` immediately |
| **Expired** | All requests with this key return `401` immediately |

### Key display

The raw API key is shown **once** at creation time. After that, only the key prefix (e.g., `fdm_live_xxxx`) and metadata (name, created date, last-used date, expiry) are visible.

### Rotation

To rotate a key:

1. Create a new API key in Developer Settings.
2. Update your integration to use the new key.
3. Verify the new key works.
4. Revoke the old key.

There is no atomic swap — plan for a brief window where both old and new keys are active.

### Leaked key response

If a key is compromised:

1. **Immediately revoke it** in Developer Settings.
2. Review the audit log for requests made with the compromised key.
3. Create a replacement key.
4. Notify the FDM team if sensitive farm data was exposed.
