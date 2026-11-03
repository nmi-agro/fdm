CREATE INDEX "field_acquiring_b_id_farm_idx" ON "fdm"."field_acquiring" USING btree ("b_id_farm");--> statement-breakpoint
CREATE INDEX "soil_sampling_b_id_date_idx" ON "fdm"."soil_sampling" USING btree ("b_id","b_sampling_date" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "soil_sampling_a_id_idx" ON "fdm"."soil_sampling" USING btree ("a_id");