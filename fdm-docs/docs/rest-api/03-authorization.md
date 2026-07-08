---
title: Authorization
sidebar_label: Authorization
sidebar_position: 3
---

# Authorization

## Effective access model

An API key has the **same effective FDM access as the user who owns it**. The key itself does not introduce separate resource scopes.

Authorization is enforced by passing the owning user's principal identifier into `fdm-core`, so the API follows the same farm, field, organization-membership, write, and delete permissions as the web application.

| Rule                                         | Consequence                                            |
| -------------------------------------------- | ------------------------------------------------------ |
| User can perform an action in the app        | Their API key can perform the corresponding API action |
| User loses access in the app                 | API key loses that access on the **next request**      |
| User cannot access a resource via `fdm-core` | API returns `403`                                      |

## Access paths

Access is evaluated on every request. Two paths grant access:

1. **Direct user access** — The user owns the resource (e.g., they created the farm).
2. **Organization membership** — The user is a member of an organization that has been granted a role on the resource.

The API does not construct a broad scope list of all the user's organizations. Each request is resolved to the owning user's principal identifier, and `fdm-core` applies its existing authorization logic.

## Role-based permissions

`fdm-core` defines three roles with the following permissions:

| Role         | Read | Write | List | Share |
| ------------ | ---- | ----- | ---- | ----- |
| `owner`      | ✅   | ✅    | ✅   | ✅    |
| `advisor`    | ✅   | ✅    | ✅   | ❌    |
| `researcher` | ✅   | ❌    | ❌   | ❌    |

Write operations (POST, PATCH, DELETE) require at least the `advisor` role. Share operations (invitations) are not available through the API in the initial release.

## Permission denied response

```json title="403 response — forbidden"
{
  "type": "https://fdm.app/api/errors/forbidden",
  "title": "Forbidden",
  "status": 403,
  "detail": "The API key does not have the required access to perform this action.",
  "instance": "/api/farms/farm_abc123",
  "error_id": "IJKL-9012"
}
```

## Membership removal

If a user's organization membership is removed, their API key loses access to resources granted through that membership on the **next request** — there is no grace period and no caching of the permission decision.

## Audit channel

All API requests are tagged with `audit_channel: "api"` in the FDM audit log. This makes API-originated actions distinguishable from web-application actions in reporting and compliance queries.
