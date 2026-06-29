CREATE TABLE "fdm-helpdesk"."agent_absences" (
	"absence_id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone NOT NULL,
	"reason" text DEFAULT 'holiday' NOT NULL,
	"note" text,
	"created" timestamp with time zone DEFAULT now() NOT NULL
);
