---
"@nmi-agro/fdm-helpdesk": minor
"@nmi-agro/fdm-app": minor
---

Support helpdesk tickets from email senders without an account, and let administrators block unwanted senders.

- `requester_email` has been added to the `tickets` table and `messages.sender_id` is now nullable, so an inbound email from an unknown sender can become a ticket. The interface shows the email address instead of a blank requester name.
- `moveInboundEmailTicketsToPrincipalUnchecked` links earlier email tickets and their messages to a principal when that sender later creates an account, so their support history appears in the in-app helpdesk on first sign-in.
- A new `blocked_emails` table and the `getEmailBlock`, `getMatchingEmailBlock`, `getEmailBlocks`, `addEmailBlock` and `removeEmailBlock` functions allow blocking senders, with case-insensitive matching and a guard against excessively long email addresses. Blocked senders can be managed from the support settings.
