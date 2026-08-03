CREATE TABLE "fdm-authz"."farm_verification" (
	"verification_id" text PRIMARY KEY NOT NULL,
	"b_id_farm" text NOT NULL,
	"principal_id" text NOT NULL,
	"b_businessid_farm" text NOT NULL,
	"verification_method" text NOT NULL,
	"verification_result" text NOT NULL,
	"assurance_level" text,
	"legal_subject_id" text,
	"acting_subject_id" text,
	"audit_id" text,
	"verified_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "farm_verification_farm_principal_revoked_idx" ON "fdm-authz"."farm_verification" USING btree ("b_id_farm","principal_id","revoked_at");