CREATE TABLE "customer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"address" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_phone_unique" UNIQUE("phone"),
	CONSTRAINT "customer_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "customer_id" uuid;--> statement-breakpoint
-- Orders placed before customers existed go to a placeholder, created only if there are any.
INSERT INTO "customer" ("name", "phone", "note")
SELECT 'Тодорхойгүй хэрэглэгч', '000000', 'Хэрэглэгч сонгох болохоос өмнө үүссэн захиалгууд.'
WHERE EXISTS (SELECT 1 FROM "order");--> statement-breakpoint
UPDATE "order" SET "customer_id" = (SELECT "id" FROM "customer" WHERE "phone" = '000000');--> statement-breakpoint
ALTER TABLE "order" ALTER COLUMN "customer_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_customer_id_idx" ON "order" USING btree ("customer_id");