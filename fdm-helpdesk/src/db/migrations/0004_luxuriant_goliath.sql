CREATE TABLE "fdm-helpdesk"."attachments" (
	"attachment_id" text PRIMARY KEY NOT NULL,
	"message_id" text NOT NULL,
	"ticket_id" text NOT NULL,
	"file_name" text NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" text NOT NULL,
	"file_path" text NOT NULL,
	"uploaded_by" text NOT NULL,
	"deleted_at" timestamp with time zone,
	"created" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fdm-helpdesk"."attachments" ADD CONSTRAINT "attachments_message_id_messages_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "fdm-helpdesk"."messages"("message_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fdm-helpdesk"."attachments" ADD CONSTRAINT "attachments_ticket_id_tickets_ticket_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "fdm-helpdesk"."tickets"("ticket_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attachment_message_idx" ON "fdm-helpdesk"."attachments" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "attachment_ticket_idx" ON "fdm-helpdesk"."attachments" USING btree ("ticket_id");