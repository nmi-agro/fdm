CREATE TABLE "fdm-authz"."farm_invitation" (
	"invitation_id" text PRIMARY KEY NOT NULL,
	"farm_id" text NOT NULL,
	"target_email" text,
	"target_principal_id" text,
	"role" text NOT NULL,
	"inviter_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	"created" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "farm_invitation_unique_email_idx" ON "fdm-authz"."farm_invitation" USING btree ("farm_id","target_email") WHERE "fdm-authz"."farm_invitation"."status" = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "farm_invitation_unique_principal_idx" ON "fdm-authz"."farm_invitation" USING btree ("farm_id","target_principal_id") WHERE "fdm-authz"."farm_invitation"."status" = 'pending';