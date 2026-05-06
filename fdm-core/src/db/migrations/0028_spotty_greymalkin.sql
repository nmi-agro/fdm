CREATE TABLE "fdm"."measure_adopting" (
	"b_id" text NOT NULL,
	"b_id_measure" text NOT NULL,
	"m_start" timestamp with time zone,
	"m_end" timestamp with time zone,
	"created" timestamp with time zone DEFAULT now() NOT NULL,
	"updated" timestamp with time zone,
	CONSTRAINT "measure_adopting_b_id_b_id_measure_pk" PRIMARY KEY("b_id","b_id_measure")
);
--> statement-breakpoint
CREATE TABLE "fdm"."measure_catalogue_enabling" (
	"b_id_farm" text NOT NULL,
	"m_source" text NOT NULL,
	"created" timestamp with time zone DEFAULT now() NOT NULL,
	"updated" timestamp with time zone,
	CONSTRAINT "measure_catalogue_enabling_b_id_farm_m_source_pk" PRIMARY KEY("b_id_farm","m_source")
);
--> statement-breakpoint
CREATE TABLE "fdm"."measures" (
	"b_id_measure" text PRIMARY KEY NOT NULL,
	"m_id" text NOT NULL,
	"created" timestamp with time zone DEFAULT now() NOT NULL,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "fdm"."measures_catalogue" (
	"m_id" text PRIMARY KEY NOT NULL,
	"m_source" text NOT NULL,
	"m_name" text NOT NULL,
	"m_description" text,
	"m_summary" text,
	"m_source_url" text,
	"m_conflicts" text[],
	"hash" text,
	"created" timestamp with time zone DEFAULT now() NOT NULL,
	"updated" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "fdm"."measure_adopting" ADD CONSTRAINT "measure_adopting_b_id_fields_b_id_fk" FOREIGN KEY ("b_id") REFERENCES "fdm"."fields"("b_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fdm"."measure_adopting" ADD CONSTRAINT "measure_adopting_b_id_measure_measures_b_id_measure_fk" FOREIGN KEY ("b_id_measure") REFERENCES "fdm"."measures"("b_id_measure") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fdm"."measure_catalogue_enabling" ADD CONSTRAINT "measure_catalogue_enabling_b_id_farm_farms_b_id_farm_fk" FOREIGN KEY ("b_id_farm") REFERENCES "fdm"."farms"("b_id_farm") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
INSERT INTO "fdm"."measure_catalogue_enabling" ("b_id_farm", "m_source")
SELECT "b_id_farm", 'bln' FROM "fdm"."farms";--> statement-breakpoint
ALTER TABLE "fdm"."measures" ADD CONSTRAINT "measures_m_id_measures_catalogue_m_id_fk" FOREIGN KEY ("m_id") REFERENCES "fdm"."measures_catalogue"("m_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "b_id_measure_idx" ON "fdm"."measures" USING btree ("b_id_measure");--> statement-breakpoint
CREATE UNIQUE INDEX "m_id_idx" ON "fdm"."measures_catalogue" USING btree ("m_id");--> statement-breakpoint
CREATE INDEX "m_source_idx" ON "fdm"."measures_catalogue" USING btree ("m_source");