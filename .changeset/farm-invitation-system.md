---
"@svenvw/fdm-core": minor
---

Instead of directly granting roles, `grantRoleToFarm` now creates a pending invitation (7-day expiry) that must be accepted by the target principal.

**New functions:**
- `acceptFarmInvitation` — accepts a pending invitation and grants the role
- `declineFarmInvitation` — declines a pending invitation
- `listPendingInvitationsForFarm` — lists active invitations for a farm (requires share permission)
- `listPendingInvitationsForUser` — lists pending invitations for the current user, including farm name and org name
- `autoAcceptInvitationsForNewUser` — auto-accepts email-based invitations on email verification
