ALTER TABLE "fdm"."cultivations_catalogue" ADD COLUMN "b_lu_ya" integer[];--> statement-breakpoint
CREATE INDEX "b_lu_ya_idx" ON "fdm"."cultivations_catalogue" USING gin ("b_lu_ya");