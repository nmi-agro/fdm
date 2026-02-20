---
"@svenvw/fdm-core": minor
---

Instead of directly granting roles, `grantRoleToFarm` now creates a pending invitation (7-day expiry) that must be accepted by the target principal. The invitation system has been refactored to be resource-agnostic, so any resource type (farm, field, etc.) can be shared via invitations.

**New generic functions (work for any resource):**
- `createInvitation` — creates a pending invitation for a resource
- `acceptInvitation` — accepts a pending invitation and grants the role
- `declineInvitation` — declines a pending invitation
- `listPendingInvitationsForPrincipal` — lists pending invitations for a principal across all resources
- `autoAcceptInvitationsForNewUser` — auto-accepts email-based invitations on email verification

**Farm-specific functions:**
- `listPendingInvitationsForFarm` — lists active invitations for a farm (requires share permission)
- `listPendingInvitationsForUser` — lists pending farm invitations for the current user, enriched with farm name and org name

