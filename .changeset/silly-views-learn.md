---
"@nmi-agro/fdm-core": minor
"@nmi-agro/fdm-app": minor
---

Now users are able to see farm invitations for their organization even if they are just a member. This is handled through the new `include_readonly` flag that can be passed to the fdm-core `listPendingInvitationsForUser` and `listPendingInvitationsForPrincipal` methods. In fdm-app the users see no accept and decline buttons, and a message that says their admin can accept or decline the invitation, if they can't accept of decline the invitation themselves.
