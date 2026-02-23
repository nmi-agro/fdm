---
title: Authorization
---

Authorization is the process of determining what actions a user is allowed to perform. The Farm Data Model (FDM) provides a resource-based permission model that allows you to control access to your data.

## The Permission Model

FDM's permission model is based on a combination of **resources**, **roles**, and **actions**.

- **Resources:** The main entities in FDM — `farm`, `field`, `cultivation`, `fertilizer_application`, `soil_analysis`, `harvesting`, `organization`, and `user`.
- **Roles:** Collections of permissions assigned to a principal for a specific resource:
  - `owner` — Full control (read, write, list, share).
  - `advisor` — Can view and edit (read, write, list), but cannot share.
  - `researcher` — Read-only access.
- **Actions:** `read`, `write`, `list`, and `share`.

### Role–Action Matrix

| Resource | owner | advisor | researcher |
|---|---|---|---|
| farm | read, write, list, **share** | read, write, list | read |
| field | read, write, list, **share** | read, write, list | read |
| cultivation | read, write, list, **share** | read, write, list | read |
| harvesting | read, write, list, **share** | read, write, list | read |
| soil\_analysis | read, write, list, **share** | read, write, list | read |
| fertilizer\_application | read, write, list, **share** | read, write, list | read |

## How Access Control is Handled

Access control is handled by the `fdm-authz` schema, which contains three main tables:

- **`role`** — Stores active role assignments. Each row links a `principal_id` to a `resource` and `resource_id` with a specific role.
- **`invitation`** — Stores pending (and historical) invitations to access a resource (see [Invitations](#invitations) below).
- **`audit`** — An audit trail of all authorization checks, recording who attempted what action on which resource and whether it was allowed or denied.

### Resource Hierarchy

Permissions are inherited through the resource hierarchy. A role granted on a parent resource also covers all child resources:

```text
farm
 └── field
      ├── cultivation
      ├── harvesting
      ├── fertilizer_application
      └── soil_analysis
```

When `checkPermission` is called, it constructs the full chain from the target resource up to `farm` and checks whether the principal holds a qualifying role on **any** resource in that chain. This means an `advisor` on a `farm` automatically has `write` access to all fields and cultivations within that farm.

## Invitations

Rather than granting roles directly, FDM uses an **invitation system** to share access. This allows the recipient to explicitly accept or decline before any role is active.

### How It Works

1. **Create** — An actor with `share` permission calls a function like `grantRoleToFarm`, which internally calls `createInvitation`. A pending invitation record is created in the `invitation` table with a 7-day expiry.
2. **Notify** — The inviter can send an email to the recipient. In `fdm-app`, the `renderFarmInvitationEmail` and `sendEmail` helpers are available for this purpose.
3. **Accept or decline** — The recipient calls `acceptInvitation` or `declineInvitation`. On acceptance, `grantRole` is called and the role becomes active.

### Email vs. Principal Targets

Invitations support two target types:

- **Principal-targeted** — The target is an existing user or organization (looked up by username or email). The `target_principal_id` column is set.
- **Email-targeted** — The target is an email address that has no account yet. The `target_email` column is set. When the user later signs up and verifies their email, `autoAcceptInvitationsForNewUser` is called automatically to claim any pending invitations.

### The `invitation` Table

The full column reference for the `invitation` table is documented in the [Database Schema](./01-database-schema.md#fdm-authz-schema-authorization).

### Invitation API

| Function | Description |
|---|---|
| `createInvitation(fdm, resource, resource_id, inviter_id, target, role, expires?)` | Creates a pending invitation; `expires` defaults to 7 days from now |
| `acceptInvitation(fdm, invitation_id, user_id)` | Accepts and activates the role |
| `declineInvitation(fdm, invitation_id, user_id)` | Declines the invitation |
| `listPendingInvitationsForPrincipal(fdm, user_id)` | Lists all pending invitations for a user |
| `autoAcceptInvitationsForNewUser(fdm, email, user_id)` | Auto-accepts email-targeted invitations after email verification |

For farm-specific helpers that add permission checks, see `grantRoleToFarm`, `listPendingInvitationsForFarm`, and `listPendingInvitationsForUser` in the farm API.
