# @nmi-agro/fdm-helpdesk

## 0.2.0

### Minor Changes

- [#722](https://github.com/nmi-agro/fdm/pull/722) [`e68b083`](https://github.com/nmi-agro/fdm/commit/e68b083aa23040fa9253011b7ccdafed6e70d160) Thanks [@SvenVw](https://github.com/SvenVw)! - Support helpdesk tickets from email senders without an account, and let administrators block unwanted senders.

  - `requester_email` has been added to the `tickets` table and `messages.sender_id` is now nullable, so an inbound email from an unknown sender can become a ticket. The interface shows the email address instead of a blank requester name.
  - `moveInboundEmailTicketsToPrincipalUnchecked` links earlier email tickets and their messages to a principal when that sender later creates an account, so their support history appears in the in-app helpdesk on first sign-in.
  - A new `blocked_emails` table and the `getEmailBlock`, `getMatchingEmailBlock`, `getEmailBlocks`, `addEmailBlock` and `removeEmailBlock` functions allow blocking senders, with case-insensitive matching and a guard against excessively long email addresses. Blocked senders can be managed from the support settings.

- [#722](https://github.com/nmi-agro/fdm/pull/722) [`e68b083`](https://github.com/nmi-agro/fdm/commit/e68b083aa23040fa9253011b7ccdafed6e70d160) Thanks [@SvenVw](https://github.com/SvenVw)! - Add agent scheduling, availability and automatic ticket routing to the helpdesk.

  - Administrators can add and edit agents, change their role and set them active or inactive from an agent management screen.
  - Agents have an `assignment_tier` (1 = first line, 2 = second line, 3 = escalation only), a set of `work_days` (default Monday through Friday) and an optional `max_tickets` limit on concurrent assignments (default 20).
  - Absences can be scheduled per agent through the new `agent_absences` table, with a start and end date, a reason (holiday, day off, sick or other) and an optional note, covered by `scheduleAbsence`, `updateAbsence`, `cancelAbsence`, `getAbsence`, `getAbsencesForAgent`, `getAbsencesForAgentsOnDate` and `getAllAbsences`.
  - The stored `agents.availability_status` column has been dropped. Availability is now derived: an agent is available when scheduled to work today and not covered by an absence. `getAgentAvailabilityStatuses` and `isAgentScheduledOn` are the canonical helpers for display code and apply the same rules that `getAvailableAgents` applies server-side, so the interface and the assignment logic cannot drift apart.
  - `autoAssignTicket` assigns a ticket to the least-loaded available agent. `getAvailableAgents` selects agents that are active, scheduled on that weekday, not absent and below their ticket ceiling, ordered by assignment tier, then number of active primary assignments, then a priority-weighted workload (low 1, normal 2, high 4, urgent 8), then display name.
  - `reassignAgentTickets` redistributes the active tickets of a departing or unavailable agent, promoting an existing co-assignee to primary where one exists and otherwise assigning to the least-loaded available agent. Reassignment is optional, and affected agents are notified by email about newly assigned tickets, capped at three emails per agent.
  - Inactive agents are no longer offered as assignment candidates.

- [#682](https://github.com/nmi-agro/fdm/pull/682) [`7551f6a`](https://github.com/nmi-agro/fdm/commit/7551f6a67b05b122cffad6f8463d3d0f19eac582) Thanks [@BoraIneviNMI](https://github.com/BoraIneviNMI)! - The server can now be configured to receive inbound emails from Postmarks, and in turn it can make these emails into tickets. It can also detect email replies and post these as messages under the corresponding ticket instead of making a new ticket.

### Patch Changes

- [#693](https://github.com/nmi-agro/fdm/pull/693) [`30f2748`](https://github.com/nmi-agro/fdm/commit/30f274831dfcc0b8404046e2e8c103e8d48e28a6) Thanks [@SvenVw](https://github.com/SvenVw)! - Migrate to TypeScript V7

- [#660](https://github.com/nmi-agro/fdm/pull/660) [`5da4dc5`](https://github.com/nmi-agro/fdm/commit/5da4dc5445c6c4613dcab9e8a78ce9ccff4867ad) Thanks [@SvenVw](https://github.com/SvenVw)! - Migrate for linting and formatting from Biome to oxlint and oxfmt

## 0.1.0

### Minor Changes

- [#628](https://github.com/nmi-agro/fdm/pull/628) [`f889ae6`](https://github.com/nmi-agro/fdm/commit/f889ae6f1bb0fe05c95f347fd9923295c59d3591) Thanks [@BoraIneviNMI](https://github.com/BoraIneviNMI)! - Added a helpdesk under the support tab, which will complement sending emails for issues encountered in fdm-app. It features ticket management and search. It lets support agents organize themselves by letting them keep track of who deals with each ticket and how much priority each ticket has. It also lets them assign tags to the tickets and categorize them. It also lets both users and agents search for the tickets they have access to and sort them, by priority, ticket creation date, tags, assignees, requesting user, or just via full-text search.
