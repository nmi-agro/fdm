CREATE TABLE "fdm-helpdesk"."agent_absences" (
	"absence_id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone NOT NULL,
	"reason" text DEFAULT 'holiday' NOT NULL,
	"note" text,
	"created" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fdm-helpdesk"."agent_absences" ADD CONSTRAINT "agent_absences_agent_id_agents_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "fdm-helpdesk"."agents"("agent_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_absences_agent_idx" ON "fdm-helpdesk"."agent_absences" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "agent_absences_start_date_idx" ON "fdm-helpdesk"."agent_absences" USING btree ("start_date");--> statement-breakpoint
CREATE INDEX "agent_absences_end_date_idx" ON "fdm-helpdesk"."agent_absences" USING btree ("end_date");