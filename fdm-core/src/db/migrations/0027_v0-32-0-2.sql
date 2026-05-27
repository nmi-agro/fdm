ALTER TABLE "fdm"."cultivation_ending" ADD PRIMARY KEY ("b_lu");--> statement-breakpoint
ALTER TABLE "fdm"."field_discarding" ADD PRIMARY KEY ("b_id");--> statement-breakpoint
ALTER TABLE "fdm"."cultivation_catalogue_selecting" ADD CONSTRAINT "cultivation_catalogue_selecting_b_id_farm_b_lu_source_pk" PRIMARY KEY("b_id_farm","b_lu_source");--> statement-breakpoint
ALTER TABLE "fdm"."cultivation_starting" ADD CONSTRAINT "cultivation_starting_b_id_b_lu_pk" PRIMARY KEY("b_id","b_lu");--> statement-breakpoint
ALTER TABLE "fdm"."derogation_applying" ADD CONSTRAINT "derogation_applying_pk" PRIMARY KEY("b_id_farm","b_id_derogation");--> statement-breakpoint
ALTER TABLE "fdm"."fertilizer_catalogue_enabling" ADD CONSTRAINT "fertilizer_catalogue_enabling_b_id_farm_p_source_pk" PRIMARY KEY("b_id_farm","p_source");--> statement-breakpoint
ALTER TABLE "fdm"."field_acquiring" ADD CONSTRAINT "field_acquiring_b_id_b_id_farm_pk" PRIMARY KEY("b_id","b_id_farm");--> statement-breakpoint
ALTER TABLE "fdm"."harvestable_sampling" ADD CONSTRAINT "harvestable_sampling_pk" PRIMARY KEY("b_id_harvestable","b_id_harvestable_analysis");--> statement-breakpoint
ALTER TABLE "fdm"."organic_certifications_holding" ADD CONSTRAINT "organic_certifications_holding_b_id_farm_b_id_organic_pk" PRIMARY KEY("b_id_farm","b_id_organic");