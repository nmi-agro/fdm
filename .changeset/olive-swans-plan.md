---
"@nmi-agro/fdm-helpdesk": minor
"@nmi-agro/fdm-app": minor
---

Add agent scheduling, availability and automatic ticket routing to the helpdesk.

- Administrators can add and edit agents, change their role and set them active or inactive from an agent management screen.
- Agents have an `assignment_tier` (1 = first line, 2 = second line, 3 = escalation only), a set of `work_days` (default Monday through Friday) and an optional `max_tickets` limit on concurrent assignments (default 20).
- Absences can be scheduled per agent through the new `agent_absences` table, with a start and end date, a reason (holiday, day off, sick or other) and an optional note, covered by `scheduleAbsence`, `updateAbsence`, `cancelAbsence`, `getAbsence`, `getAbsencesForAgent`, `getAbsencesForAgentsOnDate` and `getAllAbsences`.
- The stored `agents.availability_status` column has been dropped. Availability is now derived: an agent is available when scheduled to work today and not covered by an absence. `getAgentAvailabilityStatuses` and `isAgentScheduledOn` are the canonical helpers for display code and apply the same rules that `getAvailableAgents` applies server-side, so the interface and the assignment logic cannot drift apart.
- `autoAssignTicket` assigns a ticket to the least-loaded available agent. `getAvailableAgents` selects agents that are active, scheduled on that weekday, not absent and below their ticket ceiling, ordered by assignment tier, then number of active primary assignments, then a priority-weighted workload (low 1, normal 2, high 4, urgent 8), then display name.
- `reassignAgentTickets` redistributes the active tickets of a departing or unavailable agent, promoting an existing co-assignee to primary where one exists and otherwise assigning to the least-loaded available agent. Reassignment is optional, and affected agents are notified by email about newly assigned tickets, capped at three emails per agent.
- Inactive agents are no longer offered as assignment candidates.
