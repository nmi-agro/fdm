CREATE TYPE "fdm"."m_stage_applicability" AS ENUM('farm', 'field');--> statement-breakpoint
ALTER TABLE "fdm"."measures_catalogue" ADD COLUMN "m_stage_applicability" "fdm"."m_stage_applicability";