CREATE TABLE "fdm"."farm_group_joining" (
	"b_id_group" text NOT NULL,
	"b_id_farm" text NOT NULL,
	"b_start" timestamp with time zone NOT NULL,
	"created" timestamp with time zone DEFAULT now() NOT NULL,
	"updated" timestamp with time zone,
	CONSTRAINT "farm_group_joining_b_id_group_b_id_farm_b_start_pk" PRIMARY KEY("b_id_group","b_id_farm","b_start")
);
--> statement-breakpoint
CREATE TABLE "fdm"."farm_group_leaving" (
	"b_id_group" text NOT NULL,
	"b_id_farm" text NOT NULL,
	"b_end" timestamp with time zone NOT NULL,
	"created" timestamp with time zone DEFAULT now() NOT NULL,
	"updated" timestamp with time zone,
	CONSTRAINT "farm_group_leaving_b_id_group_b_id_farm_b_end_pk" PRIMARY KEY("b_id_group","b_id_farm","b_end")
);
--> statement-breakpoint
CREATE TABLE "fdm"."farm_groups" (
	"b_id_group" text PRIMARY KEY NOT NULL,
	"b_id_organization" text NOT NULL,
	"b_name_group" text NOT NULL,
	"created" timestamp with time zone DEFAULT now() NOT NULL,
	"updated" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "fdm"."farm_group_joining" ADD CONSTRAINT "farm_group_joining_b_id_group_farm_groups_b_id_group_fk" FOREIGN KEY ("b_id_group") REFERENCES "fdm"."farm_groups"("b_id_group") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fdm"."farm_group_joining" ADD CONSTRAINT "farm_group_joining_b_id_farm_farms_b_id_farm_fk" FOREIGN KEY ("b_id_farm") REFERENCES "fdm"."farms"("b_id_farm") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fdm"."farm_group_leaving" ADD CONSTRAINT "farm_group_leaving_b_id_group_farm_groups_b_id_group_fk" FOREIGN KEY ("b_id_group") REFERENCES "fdm"."farm_groups"("b_id_group") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fdm"."farm_group_leaving" ADD CONSTRAINT "farm_group_leaving_b_id_farm_farms_b_id_farm_fk" FOREIGN KEY ("b_id_farm") REFERENCES "fdm"."farms"("b_id_farm") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "b_id_group_idx" ON "fdm"."farm_groups" USING btree ("b_id_group");--> statement-breakpoint
CREATE INDEX "b_id_organization_group_idx" ON "fdm"."farm_groups" USING btree ("b_id_organization");