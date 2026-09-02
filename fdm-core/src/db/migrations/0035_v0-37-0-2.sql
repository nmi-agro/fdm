CREATE TABLE "fdm"."fertilizer_plan_establishing" (
	"b_id_farm" text NOT NULL,
	"p_id_plan" text NOT NULL,
	"p_plan_date" timestamp with time zone DEFAULT now() NOT NULL,
	"created" timestamp with time zone DEFAULT now() NOT NULL,
	"updated" timestamp with time zone,
	CONSTRAINT "fertilizer_plan_establishing_b_id_farm_p_id_plan_pk" PRIMARY KEY("b_id_farm","p_id_plan")
);
--> statement-breakpoint
CREATE TABLE "fdm"."fertilizer_plans" (
	"p_id_plan" text PRIMARY KEY NOT NULL,
	"p_plan_year" integer NOT NULL,
	"p_plan_file_path" text NOT NULL,
	"p_plan_hash" text NOT NULL,
	"created" timestamp with time zone DEFAULT now() NOT NULL,
	"updated" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "fdm"."fertilizer_plan_establishing" ADD CONSTRAINT "fertilizer_plan_establishing_b_id_farm_farms_b_id_farm_fk" FOREIGN KEY ("b_id_farm") REFERENCES "fdm"."farms"("b_id_farm") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fdm"."fertilizer_plan_establishing" ADD CONSTRAINT "fertilizer_plan_establishing_p_id_plan_fertilizer_plans_p_id_plan_fk" FOREIGN KEY ("p_id_plan") REFERENCES "fdm"."fertilizer_plans"("p_id_plan") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fertilizer_plan_establishing_farm_date_idx" ON "fdm"."fertilizer_plan_establishing" USING btree ("b_id_farm","p_plan_date");--> statement-breakpoint
CREATE UNIQUE INDEX "p_id_plan_idx" ON "fdm"."fertilizer_plans" USING btree ("p_id_plan");