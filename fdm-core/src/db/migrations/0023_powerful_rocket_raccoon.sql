CREATE TABLE "fdm-authz"."invitation" (
	"invitation_id" text PRIMARY KEY NOT NULL,
	"resource" text NOT NULL,
	"resource_id" text NOT NULL,
	"target_email" text,
	"target_principal_id" text,
	"role" text NOT NULL,
	"inviter_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	"created" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone,
	CONSTRAINT "invitation_target_check" CHECK ("fdm-authz"."invitation"."target_email" IS NOT NULL OR "fdm-authz"."invitation"."target_principal_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "invitation_unique_email_idx" ON "fdm-authz"."invitation" USING btree ("resource","resource_id","target_email") WHERE "fdm-authz"."invitation"."status" = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "invitation_unique_principal_idx" ON "fdm-authz"."invitation" USING btree ("resource","resource_id","target_principal_id") WHERE "fdm-authz"."invitation"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "invitation_pending_target_email_idx" ON "fdm-authz"."invitation" USING btree ("target_email") WHERE "fdm-authz"."invitation"."status" = 'pending';