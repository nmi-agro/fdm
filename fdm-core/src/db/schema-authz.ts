// Authorization
import { sql } from "drizzle-orm"
import {
    boolean,
    index,
    integer,
    pgSchema,
    text,
    timestamp,
    uniqueIndex,
} from "drizzle-orm/pg-core"

// Define postgres schema
export const fdmAuthZSchema = pgSchema("fdm-authz")
export type fdmSchemaAuthZTypeSelect = typeof fdmAuthZSchema

export const role = fdmAuthZSchema.table(
    "role",
    {
        role_id: text().primaryKey(),
        resource: text().notNull(),
        resource_id: text().notNull(),
        principal_id: text().notNull(),
        role: text().notNull(),
        created: timestamp({ withTimezone: true }).notNull().defaultNow(),
        deleted: timestamp({ withTimezone: true }),
    },
    (table) => [
        index("role_idx").on(
            table.resource,
            table.resource_id,
            table.principal_id,
            table.role,
            table.deleted,
        ),
    ],
)

export type roleTypeSelect = typeof role.$inferSelect
export type roleTypeInsert = typeof role.$inferInsert

export const audit = fdmAuthZSchema.table("audit", {
    audit_id: text().primaryKey(),
    audit_timestamp: timestamp({ withTimezone: true }).notNull().defaultNow(),
    audit_origin: text().notNull(),
    principal_id: text().notNull(),
    target_resource: text().notNull(),
    target_resource_id: text().notNull(),
    granting_resource: text().notNull(),
    granting_resource_id: text().notNull(),
    action: text().notNull(),
    allowed: boolean().notNull(),
    duration: integer().notNull(),
})

export type auditTypeSelect = typeof audit.$inferSelect
export type auditTypeInsert = typeof audit.$inferInsert

export const farmInvitation = fdmAuthZSchema.table(
    "farm_invitation",
    {
        invitation_id: text().primaryKey(),
        farm_id: text().notNull(),
        target_email: text(), // For unregistered users (lowercased/trimmed)
        target_principal_id: text(), // For registered users or organizations
        role: text().notNull(), // 'owner', 'advisor', 'researcher'
        inviter_id: text().notNull(),
        status: text().notNull().default("pending"), // 'pending', 'accepted', 'declined', 'expired'
        expires: timestamp({ withTimezone: true }).notNull(),
        created: timestamp({ withTimezone: true }).notNull().defaultNow(),
        accepted_at: timestamp({ withTimezone: true }),
    },
    (table) => [
        // Prevent duplicate pending invitations for the same target/farm
        uniqueIndex("farm_invitation_unique_email_idx")
            .on(table.farm_id, table.target_email)
            .where(sql`${table.status} = 'pending'`),
        uniqueIndex("farm_invitation_unique_principal_idx")
            .on(table.farm_id, table.target_principal_id)
            .where(sql`${table.status} = 'pending'`),
    ],
)

export type farmInvitationTypeSelect = typeof farmInvitation.$inferSelect
export type farmInvitationTypeInsert = typeof farmInvitation.$inferInsert
