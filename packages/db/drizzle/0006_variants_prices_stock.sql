CREATE TYPE "public"."product_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."stock_reason" AS ENUM('initial', 'receipt', 'return', 'damage', 'loss', 'correction');--> statement-breakpoint
CREATE TABLE "price" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"variant_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"compare_at_amount" integer,
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_to" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "price_amount_non_negative" CHECK ("price"."amount" >= 0),
	CONSTRAINT "price_compare_at_higher" CHECK ("price"."compare_at_amount" is null or "price"."compare_at_amount" > "price"."amount"),
	CONSTRAINT "price_range_valid" CHECK ("price"."valid_to" is null or "price"."valid_to" > "price"."valid_from")
);
--> statement-breakpoint
CREATE TABLE "product_option" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" smallint NOT NULL,
	"values" text[] NOT NULL,
	CONSTRAINT "product_option_position_unique" UNIQUE("product_id","position"),
	CONSTRAINT "product_option_name_unique" UNIQUE("product_id","name"),
	CONSTRAINT "product_option_position_range" CHECK ("product_option"."position" between 1 and 3),
	CONSTRAINT "product_option_has_values" CHECK (cardinality("product_option"."values") > 0)
);
--> statement-breakpoint
CREATE TABLE "variant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"sku" text,
	"option1" text,
	"option2" text,
	"option3" text,
	"position" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "variant_options_contiguous" CHECK (("variant"."option2" is null or "variant"."option1" is not null) and ("variant"."option3" is null or "variant"."option2" is not null))
);
--> statement-breakpoint
CREATE TABLE "stock_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"variant_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"reason" "stock_reason" NOT NULL,
	"note" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_ledger_quantity_nonzero" CHECK ("stock_ledger"."quantity" <> 0)
);
--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "status" "product_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "price" ADD CONSTRAINT "price_variant_id_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_option" ADD CONSTRAINT "product_option_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant" ADD CONSTRAINT "variant_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_ledger" ADD CONSTRAINT "stock_ledger_variant_id_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "price_one_open_per_variant" ON "price" USING btree ("variant_id") WHERE "price"."valid_to" is null;--> statement-breakpoint
CREATE INDEX "price_variant_valid_from_idx" ON "price" USING btree ("variant_id","valid_from");--> statement-breakpoint
CREATE INDEX "variant_product_id_idx" ON "variant" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "variant_sku_unique" ON "variant" USING btree ("sku") WHERE "variant"."archived_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "variant_combination_unique" ON "variant" USING btree ("product_id",coalesce("option1", ''),coalesce("option2", ''),coalesce("option3", '')) WHERE "variant"."archived_at" is null;--> statement-breakpoint
CREATE INDEX "stock_ledger_variant_occurred_at_idx" ON "stock_ledger" USING btree ("variant_id","occurred_at");--> statement-breakpoint
-- Hand-written backfill: every product has at least one variant from now on, so
-- products that predate variants get their single default one. It has no price
-- yet; the admin shows it as unpriced until someone sets one.
INSERT INTO "variant" ("product_id") SELECT "id" FROM "product";
