CREATE SCHEMA "fdm-helpdesk";
--> statement-breakpoint
CREATE TABLE "fdm-helpdesk"."agents" (
	"agent_id" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"role" text DEFAULT 'agent' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"availability_status" text DEFAULT 'online' NOT NULL,
	"assignment_tier" integer DEFAULT 1 NOT NULL,
	"work_days" jsonb DEFAULT '[1,2,3,4,5]'::jsonb NOT NULL,
	"max_tickets" integer DEFAULT 20,
	"created" timestamp with time zone DEFAULT now() NOT NULL,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "fdm-helpdesk"."messages" (
	"message_id" text PRIMARY KEY NOT NULL,
	"ticket_id" text NOT NULL,
	"sender_id" text NOT NULL,
	"sender_type" text NOT NULL,
	"body" text NOT NULL,
	"is_internal" boolean DEFAULT false NOT NULL,
	"created" timestamp with time zone DEFAULT now() NOT NULL,
	"updated" timestamp with time zone,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "fdm-helpdesk"."saved_replies" (
	"reply_id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"category" text,
	"created_by" text NOT NULL,
	"is_shared" boolean DEFAULT true NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"created" timestamp with time zone DEFAULT now() NOT NULL,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "fdm-helpdesk"."tags" (
	"tag_id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"name_lower" text NOT NULL,
	"color" text DEFAULT '#6b7280',
	"description" text,
	"created" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fdm-helpdesk"."ticket_activity" (
	"activity_id" text PRIMARY KEY NOT NULL,
	"ticket_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"action" text NOT NULL,
	"old_value" text,
	"new_value" text,
	"metadata" jsonb,
	"created" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fdm-helpdesk"."ticket_assignments" (
	"assignment_id" text PRIMARY KEY NOT NULL,
	"ticket_id" text NOT NULL,
	"agent_id" text NOT NULL,
	"assigned_by" text NOT NULL,
	"is_primary" boolean DEFAULT true NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"unassigned_at" timestamp with time zone,
	"unassigned_by" text,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "fdm-helpdesk"."ticket_tags_map" (
	"ticket_id" text NOT NULL,
	"tag_id" text NOT NULL,
	"created" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ticket_tags_map_pk" PRIMARY KEY("ticket_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "fdm-helpdesk"."ticket_views" (
	"ticket_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"viewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ticket_views_pk" PRIMARY KEY("ticket_id","actor_id")
);
--> statement-breakpoint
CREATE TABLE "fdm-helpdesk"."tickets" (
	"ticket_id" text PRIMARY KEY NOT NULL,
	"ticket_ref" text NOT NULL,
	"subject" text,
	"status" text DEFAULT 'open' NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"channel" text DEFAULT 'web' NOT NULL,
	"requester_id" text,
	"context_farm_id" text,
	"resolved_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created" timestamp with time zone DEFAULT now() NOT NULL,
	"updated" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "fdm-helpdesk"."messages" ADD CONSTRAINT "messages_ticket_id_tickets_ticket_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "fdm-helpdesk"."tickets"("ticket_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fdm-helpdesk"."ticket_activity" ADD CONSTRAINT "ticket_activity_ticket_id_tickets_ticket_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "fdm-helpdesk"."tickets"("ticket_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fdm-helpdesk"."ticket_assignments" ADD CONSTRAINT "ticket_assignments_ticket_id_tickets_ticket_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "fdm-helpdesk"."tickets"("ticket_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fdm-helpdesk"."ticket_assignments" ADD CONSTRAINT "ticket_assignments_agent_id_agents_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "fdm-helpdesk"."agents"("agent_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fdm-helpdesk"."ticket_tags_map" ADD CONSTRAINT "ticket_tags_map_ticket_id_tickets_ticket_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "fdm-helpdesk"."tickets"("ticket_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fdm-helpdesk"."ticket_tags_map" ADD CONSTRAINT "ticket_tags_map_tag_id_tags_tag_id_fk" FOREIGN KEY ("tag_id") REFERENCES "fdm-helpdesk"."tags"("tag_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fdm-helpdesk"."ticket_views" ADD CONSTRAINT "ticket_views_ticket_id_tickets_ticket_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "fdm-helpdesk"."tickets"("ticket_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_active_idx" ON "fdm-helpdesk"."agents" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "agent_availability_idx" ON "fdm-helpdesk"."agents" USING btree ("availability_status");--> statement-breakpoint
CREATE INDEX "agent_tier_idx" ON "fdm-helpdesk"."agents" USING btree ("assignment_tier");--> statement-breakpoint
CREATE INDEX "message_ticket_idx" ON "fdm-helpdesk"."messages" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "message_sender_idx" ON "fdm-helpdesk"."messages" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "message_created_idx" ON "fdm-helpdesk"."messages" USING btree ("ticket_id","created");--> statement-breakpoint
CREATE INDEX "saved_reply_category_idx" ON "fdm-helpdesk"."saved_replies" USING btree ("category");--> statement-breakpoint
CREATE UNIQUE INDEX "tag_name_lower_idx" ON "fdm-helpdesk"."tags" USING btree ("name_lower");--> statement-breakpoint
CREATE INDEX "activity_ticket_idx" ON "fdm-helpdesk"."ticket_activity" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "activity_created_idx" ON "fdm-helpdesk"."ticket_activity" USING btree ("ticket_id","created");--> statement-breakpoint
CREATE INDEX "assignment_ticket_idx" ON "fdm-helpdesk"."ticket_assignments" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "assignment_agent_idx" ON "fdm-helpdesk"."ticket_assignments" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "assignment_unassigned_at_idx" ON "fdm-helpdesk"."ticket_assignments" USING btree ("ticket_id","agent_id") WHERE "fdm-helpdesk"."ticket_assignments"."unassigned_at" is null;--> statement-breakpoint
CREATE INDEX "ticket_tag_ticket_idx" ON "fdm-helpdesk"."ticket_tags_map" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "ticket_tag_tag_idx" ON "fdm-helpdesk"."ticket_tags_map" USING btree ("tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_ref_idx" ON "fdm-helpdesk"."tickets" USING btree ("ticket_ref");--> statement-breakpoint
CREATE INDEX "ticket_status_idx" ON "fdm-helpdesk"."tickets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ticket_requester_idx" ON "fdm-helpdesk"."tickets" USING btree ("requester_id");--> statement-breakpoint
CREATE INDEX "ticket_priority_idx" ON "fdm-helpdesk"."tickets" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "ticket_created_idx" ON "fdm-helpdesk"."tickets" USING btree ("created");--> statement-breakpoint
CREATE INDEX "ticket_farm_idx" ON "fdm-helpdesk"."tickets" USING btree ("context_farm_id");