CREATE TYPE "fdm"."m_status" AS ENUM('active', 'inactive');--> statement-breakpoint
ALTER TABLE "fdm"."measures_catalogue" ALTER COLUMN "m_status" SET DEFAULT 'active'::"fdm"."m_status";--> statement-breakpoint
ALTER TABLE "fdm"."measures_catalogue" ALTER COLUMN "m_status" SET DATA TYPE "fdm"."m_status" USING "m_status"::"fdm"."m_status";