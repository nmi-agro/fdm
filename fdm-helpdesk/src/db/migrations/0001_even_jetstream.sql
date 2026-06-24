DROP INDEX "fdm-helpdesk"."title_search_idx";--> statement-breakpoint
CREATE INDEX "title_search_idx" ON "fdm-helpdesk"."tickets" USING gin (to_tsvector('dutch', "ticket_ref" || ' ' || "subject"));