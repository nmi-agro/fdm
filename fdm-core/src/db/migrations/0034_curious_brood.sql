CREATE TYPE "fdm"."l_herd_category" AS ENUM('rvo_100', 'rvo_101', 'rvo_102', 'rvo_104', 'rvo_112', 'rvo_115', 'rvo_116', 'rvo_117', 'rvo_120', 'rvo_122', 'rvo_550', 'rvo_551', 'rvo_552', 'rvo_600', 'rvo_601', 'rvo_602', 'rvo_941', 'rvo_943', 'rvo_961', 'rvo_971', 'rvo_973', 'rvo_974', 'rvo_981', 'rvo_982', 'rvo_991', 'rvo_992', 'rvo_400', 'rvo_401', 'rvo_404', 'rvo_406', 'rvo_407', 'rvo_411', 'rvo_300', 'rvo_301', 'rvo_310', 'rvo_311', 'rvo_312', 'rvo_200', 'rvo_201', 'rvo_202', 'rvo_210', 'rvo_751', 'rvo_900', 'rvo_901', 'rvo_801', 'rvo_802', 'rvo_803', 'rvo_15', 'rvo_25', 'rvo_28', 'rvo_35', 'rvo_37');--> statement-breakpoint
CREATE TYPE "fdm"."l_sex" AS ENUM('female', 'male');--> statement-breakpoint
CREATE TYPE "fdm"."l_species" AS ENUM('cattle', 'pig', 'poultry', 'turkey', 'duck', 'goat', 'sheep', 'horse', 'pony', 'other');--> statement-breakpoint
CREATE TYPE "fdm"."l_arriving_method" AS ENUM('born', 'purchased', 'imported');--> statement-breakpoint
CREATE TYPE "fdm"."f_batch_origin" AS ENUM('own_land', 'purchased');--> statement-breakpoint
CREATE TYPE "fdm"."f_batch_type" AS ENUM('grass_silage', 'fresh_grass', 'maize_silage', 'concentrate', 'byproduct', 'mineral', 'other');--> statement-breakpoint
CREATE TYPE "fdm"."l_grazing_type" AS ENUM('full', 'partial');--> statement-breakpoint
CREATE TYPE "fdm"."l_leaving_method" AS ENUM('died', 'sold', 'slaughtered', 'exported');--> statement-breakpoint
CREATE TABLE "fdm"."animal_arriving" (
	"l_id_animal" text NOT NULL,
	"b_id_farm" text NOT NULL,
	"l_arriving_date" timestamp with time zone,
	"l_arriving_method" "fdm"."l_arriving_method" DEFAULT 'born' NOT NULL,
	"created" timestamp with time zone DEFAULT now() NOT NULL,
	"updated" timestamp with time zone,
	CONSTRAINT "animal_arriving_l_id_animal_b_id_farm_pk" PRIMARY KEY("l_id_animal","b_id_farm")
);
--> statement-breakpoint
CREATE TABLE "fdm"."animal_assigning" (
	"l_id_animal" text NOT NULL,
	"l_id_herd" text NOT NULL,
	"l_assigning_start" timestamp with time zone NOT NULL,
	"l_assigning_end" timestamp with time zone,
	"created" timestamp with time zone DEFAULT now() NOT NULL,
	"updated" timestamp with time zone,
	CONSTRAINT "animal_assigning_l_id_animal_l_id_herd_l_assigning_start_pk" PRIMARY KEY("l_id_animal","l_id_herd","l_assigning_start")
);
--> statement-breakpoint
CREATE TABLE "fdm"."animal_leaving" (
	"l_id_animal" text PRIMARY KEY NOT NULL,
	"l_leaving_date" timestamp with time zone,
	"l_leaving_method" "fdm"."l_leaving_method",
	"created" timestamp with time zone DEFAULT now() NOT NULL,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "fdm"."animals" (
	"l_id_animal" text PRIMARY KEY NOT NULL,
	"l_id_eartag" text,
	"l_id_worknumber" text,
	"l_species" "fdm"."l_species" DEFAULT 'cattle' NOT NULL,
	"l_breed" text,
	"l_coatcolor" text,
	"l_birth_date" timestamp with time zone,
	"l_sex" "fdm"."l_sex",
	"created" timestamp with time zone DEFAULT now() NOT NULL,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "fdm"."barn_constructing" (
	"b_id_barn" text NOT NULL,
	"b_id_farm" text NOT NULL,
	"b_barn_constructing_date" timestamp with time zone,
	"created" timestamp with time zone DEFAULT now() NOT NULL,
	"updated" timestamp with time zone,
	CONSTRAINT "barn_constructing_b_id_barn_b_id_farm_pk" PRIMARY KEY("b_id_barn","b_id_farm")
);
--> statement-breakpoint
CREATE TABLE "fdm"."barn_decommissioning" (
	"b_id_barn" text PRIMARY KEY NOT NULL,
	"b_barn_decommissioning_date" timestamp with time zone,
	"created" timestamp with time zone DEFAULT now() NOT NULL,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "fdm"."barns" (
	"b_id_barn" text PRIMARY KEY NOT NULL,
	"b_barn_name" text,
	"b_floor_area" numeric,
	"b_barn_geometry" geometry(Polygon,4326),
	"created" timestamp with time zone DEFAULT now() NOT NULL,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "fdm"."excreting" (
	"l_id_excreting" text PRIMARY KEY NOT NULL,
	"l_id_herd" text NOT NULL,
	"b_id_manurepit" text NOT NULL,
	"l_excreting_start" timestamp with time zone,
	"l_excreting_end" timestamp with time zone,
	"p_amount" numeric,
	"created" timestamp with time zone DEFAULT now() NOT NULL,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "fdm"."feed_analyses" (
	"f_id_feed_analysis" text PRIMARY KEY NOT NULL,
	"f_dm" numeric,
	"f_cp" numeric,
	"f_vem" numeric,
	"f_oeb" numeric,
	"f_ndf" numeric,
	"created" timestamp with time zone DEFAULT now() NOT NULL,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "fdm"."feed_batches" (
	"f_id_batch" text PRIMARY KEY NOT NULL,
	"b_id_farm" text NOT NULL,
	"f_batch_name" text,
	"f_batch_type" "fdm"."f_batch_type",
	"f_batch_origin" "fdm"."f_batch_origin",
	"created" timestamp with time zone DEFAULT now() NOT NULL,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "fdm"."feed_sampling" (
	"f_id_batch" text NOT NULL,
	"f_id_feed_analysis" text NOT NULL,
	"f_sampling_date" timestamp with time zone,
	"created" timestamp with time zone DEFAULT now() NOT NULL,
	"updated" timestamp with time zone,
	CONSTRAINT "feed_sampling_f_id_batch_f_id_feed_analysis_pk" PRIMARY KEY("f_id_batch","f_id_feed_analysis")
);
--> statement-breakpoint
CREATE TABLE "fdm"."feeding_animal" (
	"l_id_animal" text NOT NULL,
	"f_id_batch" text NOT NULL,
	"f_feeding_start" timestamp with time zone NOT NULL,
	"f_feeding_end" timestamp with time zone,
	"f_amount" numeric,
	"created" timestamp with time zone DEFAULT now() NOT NULL,
	"updated" timestamp with time zone,
	CONSTRAINT "feeding_animal_l_id_animal_f_id_batch_f_feeding_start_pk" PRIMARY KEY("l_id_animal","f_id_batch","f_feeding_start")
);
--> statement-breakpoint
CREATE TABLE "fdm"."feeding_herd" (
	"f_id_batch" text NOT NULL,
	"l_id_herd" text NOT NULL,
	"f_feeding_start" timestamp with time zone NOT NULL,
	"f_feeding_end" timestamp with time zone,
	"f_amount" numeric,
	"created" timestamp with time zone DEFAULT now() NOT NULL,
	"updated" timestamp with time zone,
	CONSTRAINT "feeding_herd_f_id_batch_l_id_herd_f_feeding_start_pk" PRIMARY KEY("f_id_batch","l_id_herd","f_feeding_start")
);
--> statement-breakpoint
CREATE TABLE "fdm"."grazing" (
	"b_id" text,
	"l_id_herd" text NOT NULL,
	"l_grazing_start" timestamp with time zone NOT NULL,
	"l_grazing_end" timestamp with time zone,
	"l_grazing_days" integer,
	"l_grazing_hours" numeric,
	"l_grazing_area" numeric,
	"l_grazing_type" "fdm"."l_grazing_type",
	"created" timestamp with time zone DEFAULT now() NOT NULL,
	"updated" timestamp with time zone,
	CONSTRAINT "grazing_l_id_herd_l_grazing_start_pk" PRIMARY KEY("l_id_herd","l_grazing_start")
);
--> statement-breakpoint
CREATE TABLE "fdm"."herd_ending" (
	"l_id_herd" text PRIMARY KEY NOT NULL,
	"l_end" timestamp with time zone,
	"created" timestamp with time zone DEFAULT now() NOT NULL,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "fdm"."herd_starting" (
	"l_id_herd" text NOT NULL,
	"b_id_farm" text NOT NULL,
	"l_start" timestamp with time zone,
	"created" timestamp with time zone DEFAULT now() NOT NULL,
	"updated" timestamp with time zone,
	CONSTRAINT "herd_starting_l_id_herd_b_id_farm_pk" PRIMARY KEY("l_id_herd","b_id_farm")
);
--> statement-breakpoint
CREATE TABLE "fdm"."herds" (
	"l_id_herd" text PRIMARY KEY NOT NULL,
	"l_herd_name" text,
	"l_herd_category" "fdm"."l_herd_category",
	"created" timestamp with time zone DEFAULT now() NOT NULL,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "fdm"."housing" (
	"l_id_herd" text NOT NULL,
	"b_id_barn" text NOT NULL,
	"b_housing_start" timestamp with time zone NOT NULL,
	"b_housing_end" timestamp with time zone,
	"created" timestamp with time zone DEFAULT now() NOT NULL,
	"updated" timestamp with time zone,
	CONSTRAINT "housing_l_id_herd_b_id_barn_b_housing_start_pk" PRIMARY KEY("l_id_herd","b_id_barn","b_housing_start")
);
--> statement-breakpoint
CREATE TABLE "fdm"."manure_analyses" (
	"p_id_analysis" text PRIMARY KEY NOT NULL,
	"p_n_rt" numeric,
	"p_p_rt" numeric,
	"p_dm" numeric,
	"p_om" numeric,
	"created" timestamp with time zone DEFAULT now() NOT NULL,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "fdm"."manure_deliveries" (
	"p_id_delivery" text PRIMARY KEY NOT NULL,
	"created" timestamp with time zone DEFAULT now() NOT NULL,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "fdm"."manure_disposing" (
	"p_id_disposing" text PRIMARY KEY NOT NULL,
	"b_id_manurepit" text NOT NULL,
	"p_id_delivery" text NOT NULL,
	"p_disposing_date" timestamp with time zone,
	"p_amount" numeric,
	"created" timestamp with time zone DEFAULT now() NOT NULL,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "fdm"."manure_pits" (
	"b_id_manurepit" text PRIMARY KEY NOT NULL,
	"b_id_farm" text NOT NULL,
	"b_manurepit_name" text,
	"b_pit_area" numeric,
	"created" timestamp with time zone DEFAULT now() NOT NULL,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "fdm"."manure_sampling" (
	"p_id_delivery" text NOT NULL,
	"p_id_analysis" text NOT NULL,
	"p_sampling_date" timestamp with time zone,
	"created" timestamp with time zone DEFAULT now() NOT NULL,
	"updated" timestamp with time zone,
	CONSTRAINT "manure_sampling_p_id_delivery_p_id_analysis_pk" PRIMARY KEY("p_id_delivery","p_id_analysis")
);
--> statement-breakpoint
CREATE TABLE "fdm"."milk_analyses" (
	"b_id_milk_analysis" text PRIMARY KEY NOT NULL,
	"b_milk_fat" numeric,
	"b_milk_protein" numeric,
	"b_milk_lactose" numeric,
	"b_milk_urea" numeric,
	"b_milk_scc" numeric,
	"created" timestamp with time zone DEFAULT now() NOT NULL,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "fdm"."milk_deliveries" (
	"b_id_milk_delivery" text PRIMARY KEY NOT NULL,
	"created" timestamp with time zone DEFAULT now() NOT NULL,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "fdm"."milk_delivering" (
	"b_id_milk_delivering" text PRIMARY KEY NOT NULL,
	"b_id_milktank" text NOT NULL,
	"b_id_milk_delivery" text NOT NULL,
	"b_milk_delivery_date" timestamp with time zone,
	"b_milk_amount" numeric,
	"created" timestamp with time zone DEFAULT now() NOT NULL,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "fdm"."milk_sampling" (
	"b_id_milk_delivery" text NOT NULL,
	"b_id_milk_analysis" text NOT NULL,
	"b_sampling_date" timestamp with time zone,
	"created" timestamp with time zone DEFAULT now() NOT NULL,
	"updated" timestamp with time zone,
	CONSTRAINT "milk_sampling_b_id_milk_delivery_b_id_milk_analysis_pk" PRIMARY KEY("b_id_milk_delivery","b_id_milk_analysis")
);
--> statement-breakpoint
CREATE TABLE "fdm"."milk_tanks" (
	"b_id_milktank" text PRIMARY KEY NOT NULL,
	"b_id_farm" text NOT NULL,
	"b_milktank_name" text,
	"created" timestamp with time zone DEFAULT now() NOT NULL,
	"updated" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "fdm"."milking_animal" (
	"l_id_animal" text NOT NULL,
	"b_id_milktank" text NOT NULL,
	"b_milking_start" timestamp with time zone NOT NULL,
	"b_milking_end" timestamp with time zone,
	"b_milk_amount" numeric,
	"created" timestamp with time zone DEFAULT now() NOT NULL,
	"updated" timestamp with time zone,
	CONSTRAINT "milking_animal_l_id_animal_b_id_milktank_b_milking_start_pk" PRIMARY KEY("l_id_animal","b_id_milktank","b_milking_start")
);
--> statement-breakpoint
CREATE TABLE "fdm"."milking_herd" (
	"l_id_herd" text NOT NULL,
	"b_id_milktank" text NOT NULL,
	"b_milking_start" timestamp with time zone NOT NULL,
	"b_milking_end" timestamp with time zone,
	"b_milk_amount" numeric,
	"created" timestamp with time zone DEFAULT now() NOT NULL,
	"updated" timestamp with time zone,
	CONSTRAINT "milking_herd_l_id_herd_b_id_milktank_b_milking_start_pk" PRIMARY KEY("l_id_herd","b_id_milktank","b_milking_start")
);
--> statement-breakpoint
ALTER TABLE "fdm"."farms" ADD COLUMN "b_farm_livestock" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "fdm"."fertilizer_acquiring" ADD COLUMN "b_id_manurepit" text;--> statement-breakpoint
ALTER TABLE "fdm"."animal_arriving" ADD CONSTRAINT "animal_arriving_l_id_animal_animals_l_id_animal_fk" FOREIGN KEY ("l_id_animal") REFERENCES "fdm"."animals"("l_id_animal") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fdm"."animal_arriving" ADD CONSTRAINT "animal_arriving_b_id_farm_farms_b_id_farm_fk" FOREIGN KEY ("b_id_farm") REFERENCES "fdm"."farms"("b_id_farm") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fdm"."animal_assigning" ADD CONSTRAINT "animal_assigning_l_id_animal_animals_l_id_animal_fk" FOREIGN KEY ("l_id_animal") REFERENCES "fdm"."animals"("l_id_animal") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fdm"."animal_assigning" ADD CONSTRAINT "animal_assigning_l_id_herd_herds_l_id_herd_fk" FOREIGN KEY ("l_id_herd") REFERENCES "fdm"."herds"("l_id_herd") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fdm"."animal_leaving" ADD CONSTRAINT "animal_leaving_l_id_animal_animals_l_id_animal_fk" FOREIGN KEY ("l_id_animal") REFERENCES "fdm"."animals"("l_id_animal") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fdm"."barn_constructing" ADD CONSTRAINT "barn_constructing_b_id_barn_barns_b_id_barn_fk" FOREIGN KEY ("b_id_barn") REFERENCES "fdm"."barns"("b_id_barn") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fdm"."barn_constructing" ADD CONSTRAINT "barn_constructing_b_id_farm_farms_b_id_farm_fk" FOREIGN KEY ("b_id_farm") REFERENCES "fdm"."farms"("b_id_farm") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fdm"."barn_decommissioning" ADD CONSTRAINT "barn_decommissioning_b_id_barn_barns_b_id_barn_fk" FOREIGN KEY ("b_id_barn") REFERENCES "fdm"."barns"("b_id_barn") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fdm"."excreting" ADD CONSTRAINT "excreting_l_id_herd_herds_l_id_herd_fk" FOREIGN KEY ("l_id_herd") REFERENCES "fdm"."herds"("l_id_herd") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fdm"."excreting" ADD CONSTRAINT "excreting_b_id_manurepit_manure_pits_b_id_manurepit_fk" FOREIGN KEY ("b_id_manurepit") REFERENCES "fdm"."manure_pits"("b_id_manurepit") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fdm"."feed_batches" ADD CONSTRAINT "feed_batches_b_id_farm_farms_b_id_farm_fk" FOREIGN KEY ("b_id_farm") REFERENCES "fdm"."farms"("b_id_farm") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fdm"."feed_sampling" ADD CONSTRAINT "feed_sampling_f_id_batch_feed_batches_f_id_batch_fk" FOREIGN KEY ("f_id_batch") REFERENCES "fdm"."feed_batches"("f_id_batch") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fdm"."feed_sampling" ADD CONSTRAINT "feed_sampling_f_id_feed_analysis_feed_analyses_f_id_feed_analysis_fk" FOREIGN KEY ("f_id_feed_analysis") REFERENCES "fdm"."feed_analyses"("f_id_feed_analysis") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fdm"."feeding_animal" ADD CONSTRAINT "feeding_animal_l_id_animal_animals_l_id_animal_fk" FOREIGN KEY ("l_id_animal") REFERENCES "fdm"."animals"("l_id_animal") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fdm"."feeding_animal" ADD CONSTRAINT "feeding_animal_f_id_batch_feed_batches_f_id_batch_fk" FOREIGN KEY ("f_id_batch") REFERENCES "fdm"."feed_batches"("f_id_batch") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fdm"."feeding_herd" ADD CONSTRAINT "feeding_herd_f_id_batch_feed_batches_f_id_batch_fk" FOREIGN KEY ("f_id_batch") REFERENCES "fdm"."feed_batches"("f_id_batch") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fdm"."feeding_herd" ADD CONSTRAINT "feeding_herd_l_id_herd_herds_l_id_herd_fk" FOREIGN KEY ("l_id_herd") REFERENCES "fdm"."herds"("l_id_herd") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fdm"."grazing" ADD CONSTRAINT "grazing_b_id_fields_b_id_fk" FOREIGN KEY ("b_id") REFERENCES "fdm"."fields"("b_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fdm"."grazing" ADD CONSTRAINT "grazing_l_id_herd_herds_l_id_herd_fk" FOREIGN KEY ("l_id_herd") REFERENCES "fdm"."herds"("l_id_herd") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fdm"."herd_ending" ADD CONSTRAINT "herd_ending_l_id_herd_herds_l_id_herd_fk" FOREIGN KEY ("l_id_herd") REFERENCES "fdm"."herds"("l_id_herd") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fdm"."herd_starting" ADD CONSTRAINT "herd_starting_l_id_herd_herds_l_id_herd_fk" FOREIGN KEY ("l_id_herd") REFERENCES "fdm"."herds"("l_id_herd") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fdm"."herd_starting" ADD CONSTRAINT "herd_starting_b_id_farm_farms_b_id_farm_fk" FOREIGN KEY ("b_id_farm") REFERENCES "fdm"."farms"("b_id_farm") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fdm"."housing" ADD CONSTRAINT "housing_l_id_herd_herds_l_id_herd_fk" FOREIGN KEY ("l_id_herd") REFERENCES "fdm"."herds"("l_id_herd") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fdm"."housing" ADD CONSTRAINT "housing_b_id_barn_barns_b_id_barn_fk" FOREIGN KEY ("b_id_barn") REFERENCES "fdm"."barns"("b_id_barn") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fdm"."manure_disposing" ADD CONSTRAINT "manure_disposing_b_id_manurepit_manure_pits_b_id_manurepit_fk" FOREIGN KEY ("b_id_manurepit") REFERENCES "fdm"."manure_pits"("b_id_manurepit") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fdm"."manure_disposing" ADD CONSTRAINT "manure_disposing_p_id_delivery_manure_deliveries_p_id_delivery_fk" FOREIGN KEY ("p_id_delivery") REFERENCES "fdm"."manure_deliveries"("p_id_delivery") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fdm"."manure_pits" ADD CONSTRAINT "manure_pits_b_id_farm_farms_b_id_farm_fk" FOREIGN KEY ("b_id_farm") REFERENCES "fdm"."farms"("b_id_farm") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fdm"."manure_sampling" ADD CONSTRAINT "manure_sampling_p_id_delivery_manure_deliveries_p_id_delivery_fk" FOREIGN KEY ("p_id_delivery") REFERENCES "fdm"."manure_deliveries"("p_id_delivery") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fdm"."manure_sampling" ADD CONSTRAINT "manure_sampling_p_id_analysis_manure_analyses_p_id_analysis_fk" FOREIGN KEY ("p_id_analysis") REFERENCES "fdm"."manure_analyses"("p_id_analysis") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fdm"."milk_delivering" ADD CONSTRAINT "milk_delivering_b_id_milktank_milk_tanks_b_id_milktank_fk" FOREIGN KEY ("b_id_milktank") REFERENCES "fdm"."milk_tanks"("b_id_milktank") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fdm"."milk_delivering" ADD CONSTRAINT "milk_delivering_b_id_milk_delivery_milk_deliveries_b_id_milk_delivery_fk" FOREIGN KEY ("b_id_milk_delivery") REFERENCES "fdm"."milk_deliveries"("b_id_milk_delivery") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fdm"."milk_sampling" ADD CONSTRAINT "milk_sampling_b_id_milk_delivery_milk_deliveries_b_id_milk_delivery_fk" FOREIGN KEY ("b_id_milk_delivery") REFERENCES "fdm"."milk_deliveries"("b_id_milk_delivery") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fdm"."milk_sampling" ADD CONSTRAINT "milk_sampling_b_id_milk_analysis_milk_analyses_b_id_milk_analysis_fk" FOREIGN KEY ("b_id_milk_analysis") REFERENCES "fdm"."milk_analyses"("b_id_milk_analysis") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fdm"."milk_tanks" ADD CONSTRAINT "milk_tanks_b_id_farm_farms_b_id_farm_fk" FOREIGN KEY ("b_id_farm") REFERENCES "fdm"."farms"("b_id_farm") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fdm"."milking_animal" ADD CONSTRAINT "milking_animal_l_id_animal_animals_l_id_animal_fk" FOREIGN KEY ("l_id_animal") REFERENCES "fdm"."animals"("l_id_animal") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fdm"."milking_animal" ADD CONSTRAINT "milking_animal_b_id_milktank_milk_tanks_b_id_milktank_fk" FOREIGN KEY ("b_id_milktank") REFERENCES "fdm"."milk_tanks"("b_id_milktank") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fdm"."milking_herd" ADD CONSTRAINT "milking_herd_l_id_herd_herds_l_id_herd_fk" FOREIGN KEY ("l_id_herd") REFERENCES "fdm"."herds"("l_id_herd") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fdm"."milking_herd" ADD CONSTRAINT "milking_herd_b_id_milktank_milk_tanks_b_id_milktank_fk" FOREIGN KEY ("b_id_milktank") REFERENCES "fdm"."milk_tanks"("b_id_milktank") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "l_id_animal_idx" ON "fdm"."animals" USING btree ("l_id_animal");--> statement-breakpoint
CREATE UNIQUE INDEX "b_id_barn_idx" ON "fdm"."barns" USING btree ("b_id_barn");--> statement-breakpoint
CREATE INDEX "b_barn_geom_idx" ON "fdm"."barns" USING gist ("b_barn_geometry");--> statement-breakpoint
CREATE UNIQUE INDEX "l_id_excreting_idx" ON "fdm"."excreting" USING btree ("l_id_excreting");--> statement-breakpoint
CREATE UNIQUE INDEX "f_id_feed_analysis_idx" ON "fdm"."feed_analyses" USING btree ("f_id_feed_analysis");--> statement-breakpoint
CREATE UNIQUE INDEX "f_id_batch_idx" ON "fdm"."feed_batches" USING btree ("f_id_batch");--> statement-breakpoint
CREATE UNIQUE INDEX "l_id_herd_idx" ON "fdm"."herds" USING btree ("l_id_herd");--> statement-breakpoint
CREATE UNIQUE INDEX "p_id_analysis_idx" ON "fdm"."manure_analyses" USING btree ("p_id_analysis");--> statement-breakpoint
CREATE UNIQUE INDEX "p_id_delivery_idx" ON "fdm"."manure_deliveries" USING btree ("p_id_delivery");--> statement-breakpoint
CREATE UNIQUE INDEX "p_id_disposing_idx" ON "fdm"."manure_disposing" USING btree ("p_id_disposing");--> statement-breakpoint
CREATE UNIQUE INDEX "b_id_manurepit_idx" ON "fdm"."manure_pits" USING btree ("b_id_manurepit");--> statement-breakpoint
CREATE UNIQUE INDEX "b_id_milk_analysis_idx" ON "fdm"."milk_analyses" USING btree ("b_id_milk_analysis");--> statement-breakpoint
CREATE UNIQUE INDEX "b_id_milk_delivery_idx" ON "fdm"."milk_deliveries" USING btree ("b_id_milk_delivery");--> statement-breakpoint
CREATE UNIQUE INDEX "b_id_milk_delivering_idx" ON "fdm"."milk_delivering" USING btree ("b_id_milk_delivering");--> statement-breakpoint
CREATE UNIQUE INDEX "b_id_milktank_idx" ON "fdm"."milk_tanks" USING btree ("b_id_milktank");--> statement-breakpoint
ALTER TABLE "fdm"."fertilizer_acquiring" ADD CONSTRAINT "fertilizer_acquiring_b_id_manurepit_manure_pits_b_id_manurepit_fk" FOREIGN KEY ("b_id_manurepit") REFERENCES "fdm"."manure_pits"("b_id_manurepit") ON DELETE no action ON UPDATE no action;