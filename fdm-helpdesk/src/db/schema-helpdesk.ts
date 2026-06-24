import { isNull, sql } from "drizzle-orm"
import {
    boolean,
    index,
    integer,
    jsonb,
    pgSchema,
    primaryKey,
    text,
    timestamp,
    uniqueIndex,
} from "drizzle-orm/pg-core"

// Define postgres schema
export const fdmHelpdeskSchema = pgSchema("fdm-helpdesk")
export type fdmHelpdeskSchemaTypeSelect = typeof fdmHelpdeskSchema

/* ================ TICKETS ================ */
/**
 * Support tickets — the core entity.
 *
 * Tickets are created by end-users (requester_id references fdm-authn user.id)
 * and can optionally be linked to a farm (context_farm_id) for farm-specific issues.
 */
export const tickets = fdmHelpdeskSchema.table(
    "tickets",
    {
        ticket_id: text().primaryKey(), // createId()
        ticket_ref: text().notNull(), // Human-readable ref, e.g. "TK-A7K2M4" (nanoid, not sequential)
        subject: text(), // Auto-generated from first message via summarizeForSubject()
        status: text().notNull().default("open"), // 'open', 'pending', 'in_progress', 'waiting_on_customer', 'resolved', 'closed'
        priority: text().notNull().default("normal"), // 'low', 'normal', 'high', 'urgent'
        channel: text().notNull().default("web"), // 'web', 'email'
        requester_id: text(), // References fdm-authn user.id (null for unmatched email senders)
        context_farm_id: text(), // Optional: link to fdm.farms.b_id_farm
        resolved_at: timestamp({ withTimezone: true }),
        closed_at: timestamp({ withTimezone: true }),
        created: timestamp({ withTimezone: true }).notNull().defaultNow(),
        updated: timestamp({ withTimezone: true }),
    },
    (table) => [
        uniqueIndex("ticket_ref_idx").on(table.ticket_ref),
        index("ticket_status_idx").on(table.status),
        index("ticket_requester_idx").on(table.requester_id),
        index("ticket_priority_idx").on(table.priority),
        index("ticket_created_idx").on(table.created),
        index("ticket_farm_idx").on(table.context_farm_id),
        index("title_search_idx").using(
            "gin",
            sql`to_tsvector('dutch', ${table.ticket_ref} || ' ' || coalesce(${table.subject}, ''))`,
        ),
    ],
)
export type TicketTypeSelect = typeof tickets.$inferSelect
export type TicketTypeInsert = typeof tickets.$inferInsert

/* ================ AGENTS ================ */
/**
 * Agents are users who can handle support tickets.
 * References fdm-authn.user via principal_id.
 */
export const agents = fdmHelpdeskSchema.table(
    "agents",
    {
        agent_id: text().primaryKey(), // createId(), references fdm-authn user.id
        display_name: text().notNull(),
        role: text().notNull().default("agent"), // 'admin', 'agent'
        is_active: boolean().notNull().default(true),
        availability_status: text().notNull().default("online"), // 'online', 'away', 'out_of_office'
        assignment_tier: integer().notNull().default(1), // 1=first-line, 2=second-line, 3=escalation-only (last resort)
        work_days: jsonb().notNull().default([1, 2, 3, 4, 5]), // ISO weekdays: 1=Mon, 2=Tue, ..., 7=Sun
        max_tickets: integer().default(20), // Max concurrent assignments
        created: timestamp({ withTimezone: true }).notNull().defaultNow(),
        updated: timestamp({ withTimezone: true }),
    },
    (table) => [
        index("agent_active_idx").on(table.is_active),
        index("agent_availability_idx").on(table.availability_status),
        index("agent_tier_idx").on(table.assignment_tier),
    ],
)
export type AgentTypeSelect = typeof agents.$inferSelect
export type AgentTypeInsert = typeof agents.$inferInsert

/**
 * Ticket assignment to agents.
 * Supports multiple agents per ticket and assignment history.
 */
export const ticketAssignments = fdmHelpdeskSchema.table(
    "ticket_assignments",
    {
        assignment_id: text().primaryKey(),
        ticket_id: text()
            .notNull()
            .references(() => tickets.ticket_id),
        agent_id: text()
            .notNull()
            .references(() => agents.agent_id),
        assigned_by: text().notNull(), // principal_id of who assigned
        is_primary: boolean().notNull().default(true), // Primary assignee
        assigned_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
        unassigned_at: timestamp({ withTimezone: true }),
        unassigned_by: text(), // principal_id of who unassigned
        updated_at: timestamp({ withTimezone: true }),
    },
    (table) => [
        index("assignment_ticket_idx").on(table.ticket_id),
        index("assignment_agent_idx").on(table.agent_id),
        index("assignment_unassigned_at_idx")
            .on(table.ticket_id, table.agent_id)
            .where(isNull(table.unassigned_at)),
    ],
)
export type TicketAssignmentTypeSelect = typeof ticketAssignments.$inferSelect
export type TicketAssignmentTypeInsert = typeof ticketAssignments.$inferInsert

/**
 * Record of who viewed each ticket
 */
export const ticketViews = fdmHelpdeskSchema.table(
    "ticket_views",
    {
        ticket_id: text()
            .notNull()
            .references(() => tickets.ticket_id),
        actor_id: text().notNull(),
        viewed_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        primaryKey({
            name: "ticket_views_pk",
            columns: [table.ticket_id, table.actor_id],
        }),
    ],
)

export type TicketViewTypeSelect = typeof ticketViews.$inferSelect
export type TicketViewTypeInsert = typeof ticketViews.$inferInsert

/**
 * Activity log for ticket state changes.
 * Tracks who did what and when — essential for accountability.
 */
export const ticketActivity = fdmHelpdeskSchema.table(
    "ticket_activity",
    {
        activity_id: text().primaryKey(),
        ticket_id: text()
            .notNull()
            .references(() => tickets.ticket_id),
        actor_id: text().notNull(), // Who performed the action
        action: text().notNull(), // 'created', 'assigned', 'status_changed', 'priority_changed', 'tag_added', 'tag_removed', 'note_added', 'resolved', 'closed', 'reopened', 'ai_triaged', 'impersonation_started', 'impersonation_ended'
        old_value: text(), // Previous value (e.g., old status)
        new_value: text(), // New value (e.g., new status)
        metadata: jsonb(), // Complex context (AI reasoning, impersonation details, etc.)
        created: timestamp({ withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        index("activity_ticket_idx").on(table.ticket_id),
        index("activity_created_idx").on(table.ticket_id, table.created),
    ],
)
export type TicketActivityTypeSelect = typeof ticketActivity.$inferSelect
export type TicketActivityTypeInsert = typeof ticketActivity.$inferInsert

/* ================ TAGS ================ */
/**
 * Tags for categorizing tickets.
 */
export const tags = fdmHelpdeskSchema.table(
    "tags",
    {
        tag_id: text().primaryKey(),
        name: text().notNull(),
        name_lower: text().notNull(),
        color: text().default("#6b7280"), // Hex color for UI
        description: text(),
        created: timestamp({ withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [uniqueIndex("tag_name_lower_idx").on(table.name_lower)],
)
export type TagTypeSelect = typeof tags.$inferSelect
export type TagTypeInsert = typeof tags.$inferInsert

/**
 * Ticket-tag many-to-many mapping.
 */
export const ticketTagsMap = fdmHelpdeskSchema.table(
    "ticket_tags_map",
    {
        ticket_id: text()
            .notNull()
            .references(() => tickets.ticket_id),
        tag_id: text()
            .notNull()
            .references(() => tags.tag_id),
        created: timestamp({ withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        primaryKey({
            name: "ticket_tags_map_pk",
            columns: [table.ticket_id, table.tag_id],
        }),
        index("ticket_tag_ticket_idx").on(table.ticket_id),
        index("ticket_tag_tag_idx").on(table.tag_id),
    ],
)

/* MESSAGE THREADS */
/**
 * Messages within a ticket conversation.
 *
 * sender_type distinguishes between customer replies and agent replies.
 * Internal notes (is_internal = true) are only visible to agents.
 */
export const messages = fdmHelpdeskSchema.table(
    "messages",
    {
        message_id: text().primaryKey(),
        ticket_id: text()
            .notNull()
            .references(() => tickets.ticket_id),
        sender_id: text().notNull(), // References fdm-authn user.id
        sender_type: text().notNull(), // 'customer', 'agent'
        body: text().notNull(), // Message content (supports markdown)
        is_internal: boolean().notNull().default(false), // Internal note (agent-only)
        created: timestamp({ withTimezone: true }).notNull().defaultNow(),
        updated: timestamp({ withTimezone: true }),
        deleted_at: timestamp({ withTimezone: true }), // Soft-delete for GDPR compliance
    },
    (table) => [
        index("message_ticket_idx").on(table.ticket_id),
        index("message_sender_idx").on(table.sender_id),
        index("message_created_idx").on(table.ticket_id, table.created),
        index("message_search_idx").using(
            "gin",
            sql`to_tsvector('dutch', ${table.body})`,
        ),
    ],
)
export type MessageTypeSelect = typeof messages.$inferSelect
export type MessageTypeInsert = typeof messages.$inferInsert

/* SAVED REPLIES - TO BE USED AS TEMPLATES */
/**
 * Saved reply templates for agents.
 * Supports variables like {{customer_name}}, {{ticket_ref}}, etc.
 */
export const savedReplies = fdmHelpdeskSchema.table(
    "saved_replies",
    {
        reply_id: text().primaryKey(),
        title: text().notNull(), // Short name for quick search
        body: text().notNull(), // Template body with variables
        category: text(), // Optional grouping
        created_by: text().notNull(), // Agent who created it
        is_shared: boolean().notNull().default(true), // Visible to all agents
        usage_count: integer().notNull().default(0),
        created: timestamp({ withTimezone: true }).notNull().defaultNow(),
        updated: timestamp({ withTimezone: true }),
    },
    (table) => [index("saved_reply_category_idx").on(table.category)],
)
export type SavedReplyTypeSelect = typeof savedReplies.$inferSelect
export type SavedReplyTypeInsert = typeof savedReplies.$inferInsert
