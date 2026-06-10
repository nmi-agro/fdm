CREATE TYPE "fdm"."a_image_annotation_type" AS ENUM('pin', 'circle', 'arrow', 'freehand');--> statement-breakpoint
CREATE TYPE "fdm"."a_image_annotation_bcs" AS ENUM('a_ss_bcs', 'a_sc_bcs', 'a_rd_bcs', 'a_ew_bcs', 'a_cc_bcs', 'a_gs_bcs', 'a_p_bcs', 'a_c_bcs', 'a_rt_bcs');--> statement-breakpoint
CREATE TYPE "fdm"."a_image_type" AS ENUM('profile', 'surface', 'roots', 'earthworms', 'structure', 'other');--> statement-breakpoint
CREATE TABLE "fdm"."soil_image" (
	"a_id_image" text PRIMARY KEY NOT NULL,
	"b_id_sampling" text NOT NULL,
	"a_image_path" text NOT NULL,
	"a_image_type" "fdm"."a_image_type",
	"a_image_order" integer DEFAULT 0 NOT NULL,
	"a_image_caption" text,
	"created" timestamp with time zone DEFAULT now() NOT NULL,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "fdm"."soil_image_annotating" (
	"a_id_annotation" text PRIMARY KEY NOT NULL,
	"a_id_image" text NOT NULL,
	"a_image_annotation_type" "fdm"."a_image_annotation_type" NOT NULL,
	"a_image_annotation_coordinates" jsonb NOT NULL,
	"a_image_annotation" text,
	"a_image_annotation_bcs" "fdm"."a_image_annotation_bcs",
	"a_image_annotation_order" integer DEFAULT 0 NOT NULL,
	"created" timestamp with time zone DEFAULT now() NOT NULL,
	"updated" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "fdm"."soil_analysis" ADD COLUMN "a_ss_bcs" numeric;--> statement-breakpoint
ALTER TABLE "fdm"."soil_analysis" ADD COLUMN "a_sc_bcs" numeric;--> statement-breakpoint
ALTER TABLE "fdm"."soil_analysis" ADD COLUMN "a_rd_bcs" numeric;--> statement-breakpoint
ALTER TABLE "fdm"."soil_analysis" ADD COLUMN "a_ew_bcs" numeric;--> statement-breakpoint
ALTER TABLE "fdm"."soil_analysis" ADD COLUMN "a_cc_bcs" numeric;--> statement-breakpoint
ALTER TABLE "fdm"."soil_analysis" ADD COLUMN "a_gs_bcs" numeric;--> statement-breakpoint
ALTER TABLE "fdm"."soil_analysis" ADD COLUMN "a_p_bcs" numeric;--> statement-breakpoint
ALTER TABLE "fdm"."soil_analysis" ADD COLUMN "a_c_bcs" numeric;--> statement-breakpoint
ALTER TABLE "fdm"."soil_analysis" ADD COLUMN "a_rt_bcs" numeric;--> statement-breakpoint
ALTER TABLE "fdm-calculator"."calculation_cache" ADD COLUMN "entity_type" text;--> statement-breakpoint
ALTER TABLE "fdm-calculator"."calculation_cache" ADD COLUMN "entity_id" text;--> statement-breakpoint
ALTER TABLE "fdm-calculator"."calculation_cache" ADD COLUMN "is_processing" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "fdm"."soil_image" ADD CONSTRAINT "soil_image_b_id_sampling_soil_sampling_b_id_sampling_fk" FOREIGN KEY ("b_id_sampling") REFERENCES "fdm"."soil_sampling"("b_id_sampling") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fdm"."soil_image_annotating" ADD CONSTRAINT "soil_image_annotating_a_id_image_soil_image_a_id_image_fk" FOREIGN KEY ("a_id_image") REFERENCES "fdm"."soil_image"("a_id_image") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "soil_image_b_id_sampling_idx" ON "fdm"."soil_image" USING btree ("b_id_sampling");--> statement-breakpoint
CREATE INDEX "soil_image_annotating_a_id_image_idx" ON "fdm"."soil_image_annotating" USING btree ("a_id_image");--> statement-breakpoint
CREATE INDEX "calculation_cache_entity_idx" ON "fdm-calculator"."calculation_cache" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "calculation_cache_function_idx" ON "fdm-calculator"."calculation_cache" USING btree ("calculation_function");