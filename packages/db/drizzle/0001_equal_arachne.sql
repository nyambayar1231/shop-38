CREATE TYPE "public"."category_status" AS ENUM('active', 'inactive');--> statement-breakpoint
ALTER TABLE "category" ADD COLUMN "status" "category_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
CREATE INDEX "category_status_idx" ON "category" USING btree ("status");