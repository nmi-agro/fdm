CREATE TYPE "fdm"."annotation_type" AS ENUM('pin', 'circle', 'arrow', 'freehand');--> statement-breakpoint
CREATE TYPE "fdm"."assessment_type" AS ENUM('kuilmeting', 'bedrijfsmeting');--> statement-breakpoint
CREATE TYPE "fdm"."bcs_indicator" AS ENUM('A_SS_BCS', 'A_SC_BCS', 'A_RD_BCS', 'A_EW_BCS', 'A_CC_BCS', 'A_GS_BCS', 'A_P_BCS', 'A_C_BCS', 'A_RT_BCS');--> statement-breakpoint
CREATE TYPE "fdm"."visual_image_type" AS ENUM('profile', 'surface', 'roots', 'earthworms', 'structure', 'other');--> statement-breakpoint
CREATE TABLE "fdm"."soil_analysis_visual" (
	"a_id_visual" text PRIMARY KEY NOT NULL,
	"b_id_sampling" text NOT NULL,
	"date" timestamp with time zone,
	"assessor_name" text,
	"assessment_type" "fdm"."assessment_type",
	"a_ss_bcs" numeric,
	"a_sc_bcs" numeric,
	"a_rd_bcs" numeric,
	"a_ew_bcs" numeric,
	"a_cc_bcs" numeric,
	"a_gs_bcs" numeric,
	"a_p_bcs" numeric,
	"a_c_bcs" numeric,
	"a_rt_bcs" numeric,
	"d_bcs" numeric,
	"i_bcs" numeric,
	"notes" text,
	"weather_conditions" text,
	"created" timestamp with time zone DEFAULT now() NOT NULL,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "fdm"."soil_analysis_visual_annotation" (
	"a_id_annotation" text PRIMARY KEY NOT NULL,
	"a_id_image" text NOT NULL,
	"type" "fdm"."annotation_type" NOT NULL,
	"data_json" text NOT NULL,
	"text" text,
	"indicator" "fdm"."bcs_indicator",
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created" timestamp with time zone DEFAULT now() NOT NULL,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "fdm"."soil_analysis_visual_image" (
	"a_id_image" text PRIMARY KEY NOT NULL,
	"a_id_visual" text NOT NULL,
	"gcs_object_key" text NOT NULL,
	"image_type" "fdm"."visual_image_type",
	"sort_order" integer DEFAULT 0 NOT NULL,
	"caption" text,
	"created" timestamp with time zone DEFAULT now() NOT NULL,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "fdm"."soil_sampling_visual" (
	"b_id_sampling" text PRIMARY KEY NOT NULL,
	"b_id" text NOT NULL,
	"a_id" text,
	"a_depth_upper" numeric DEFAULT 0 NOT NULL,
	"a_depth_lower" numeric,
	"b_sampling_date" timestamp with time zone,
	"created" timestamp with time zone DEFAULT now() NOT NULL,
	"updated" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "fdm"."soil_analysis_visual" ADD CONSTRAINT "soil_analysis_visual_b_id_sampling_soil_sampling_visual_b_id_sampling_fk" FOREIGN KEY ("b_id_sampling") REFERENCES "fdm"."soil_sampling_visual"("b_id_sampling") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fdm"."soil_analysis_visual_annotation" ADD CONSTRAINT "soil_analysis_visual_annotation_a_id_image_soil_analysis_visual_image_a_id_image_fk" FOREIGN KEY ("a_id_image") REFERENCES "fdm"."soil_analysis_visual_image"("a_id_image") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fdm"."soil_analysis_visual_image" ADD CONSTRAINT "soil_analysis_visual_image_a_id_visual_soil_analysis_visual_a_id_visual_fk" FOREIGN KEY ("a_id_visual") REFERENCES "fdm"."soil_analysis_visual"("a_id_visual") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fdm"."soil_sampling_visual" ADD CONSTRAINT "soil_sampling_visual_b_id_fields_b_id_fk" FOREIGN KEY ("b_id") REFERENCES "fdm"."fields"("b_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fdm"."soil_sampling_visual" ADD CONSTRAINT "soil_sampling_visual_a_id_soil_analysis_a_id_fk" FOREIGN KEY ("a_id") REFERENCES "fdm"."soil_analysis"("a_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "a_id_image_annotation_idx" ON "fdm"."soil_analysis_visual_annotation" USING btree ("a_id_image");--> statement-breakpoint
CREATE INDEX "a_id_visual_image_idx" ON "fdm"."soil_analysis_visual_image" USING btree ("a_id_visual");