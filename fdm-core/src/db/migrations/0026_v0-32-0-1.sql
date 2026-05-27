CREATE TYPE "fdm"."p_app_amount_unit" AS ENUM('kg/ha', 'l/ha', 'm3/ha', 'ton/ha');--> statement-breakpoint
ALTER TABLE "fdm"."fertilizers_catalogue" ADD COLUMN "p_app_amount_unit" "fdm"."p_app_amount_unit" DEFAULT 'kg/ha' NOT NULL;--> statement-breakpoint
UPDATE "fdm"."fertilizers_catalogue" SET "hash" = '0000' WHERE "p_source" IN ('baat', 'srm');