ALTER TABLE "fdm"."cultivations_catalogue" RENAME COLUMN "b_lu_eom_residues" TO "b_lu_eom_residue";--> statement-breakpoint
UPDATE "fdm"."cultivations_catalogue" SET "hash" = '0000';