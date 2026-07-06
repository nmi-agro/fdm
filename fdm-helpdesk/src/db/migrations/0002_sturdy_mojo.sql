CREATE TABLE "fdm-helpdesk"."blocked_emails" (
	"email" text PRIMARY KEY NOT NULL,
	"reason" text,
	"blocked_by" text NOT NULL,
	"created" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fdm-helpdesk"."tickets" ADD COLUMN "requester_email" text;--> statement-breakpoint
CREATE INDEX "ticket_requester_email_idx" ON "fdm-helpdesk"."tickets" USING btree (lower("requester_email"));