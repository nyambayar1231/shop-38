CREATE TYPE "public"."file_status" AS ENUM('pending', 'uploaded');--> statement-breakpoint
CREATE TABLE "file" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"content_type" text NOT NULL,
	"size" bigint NOT NULL,
	"url" text,
	"status" "file_status" DEFAULT 'pending' NOT NULL,
	"uploaded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "file_key_unique" UNIQUE("key"),
	CONSTRAINT "file_size_positive" CHECK ("file"."size" > 0),
	CONSTRAINT "file_uploaded_has_url" CHECK ("file"."status" <> 'uploaded' or ("file"."url" is not null and "file"."uploaded_at" is not null))
);
--> statement-breakpoint
CREATE INDEX "file_status_created_at_idx" ON "file" USING btree ("status","created_at");