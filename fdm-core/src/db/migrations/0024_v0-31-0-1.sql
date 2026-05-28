ALTER TABLE "fdm-authn"."rate_limit" ALTER COLUMN "key" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "fdm-authn"."rate_limit" ALTER COLUMN "count" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "fdm-authn"."rate_limit" ALTER COLUMN "last_request" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "fdm-authn"."rate_limit" ADD CONSTRAINT "rate_limit_key_unique" UNIQUE("key");