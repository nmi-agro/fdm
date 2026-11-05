ALTER TABLE "fdm"."measures_catalogue" ADD COLUMN "m_effect_costs" numeric;--> statement-breakpoint
ALTER TABLE "fdm"."measures_catalogue" ADD COLUMN "m_effect_type" text;--> statement-breakpoint
ALTER TABLE "fdm"."measures_catalogue" ADD COLUMN "m_impacts_score" text[];--> statement-breakpoint
ALTER TABLE "fdm"."measures_catalogue" ADD COLUMN "m_applicability" jsonb;--> statement-breakpoint
ALTER TABLE "fdm"."measures_catalogue" ADD COLUMN "m_effect_size" jsonb;--> statement-breakpoint
ALTER TABLE "fdm"."measures_catalogue" ADD COLUMN "m_origin" text;--> statement-breakpoint
ALTER TABLE "fdm"."measures_catalogue" ADD COLUMN "m_external_ids" jsonb;--> statement-breakpoint
ALTER TABLE "fdm"."measures_catalogue" ADD COLUMN "m_status" text DEFAULT 'active' NOT NULL;