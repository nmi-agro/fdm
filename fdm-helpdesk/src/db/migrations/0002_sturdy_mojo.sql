ALTER TABLE "fdm-helpdesk"."tickets" ADD COLUMN "requester_email" text;--> statement-breakpoint
CREATE INDEX "ticket_requester_email_idx" ON "fdm-helpdesk"."tickets" USING btree ("requester_email");