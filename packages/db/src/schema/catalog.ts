import { sql } from 'drizzle-orm';
import {
  pgTable,
  text,
  uuid,
  timestamp,
  index,
  pgEnum,
  integer,
  smallint,
  check,
  unique,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { CATEGORY_STATUSES, PRODUCT_STATUSES } from '@shop-38/contracts';
import { file } from './file.js';

export const categoryStatus = pgEnum('category_status', CATEGORY_STATUSES);

export const category = pgTable(
  'category',
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text('name').unique().notNull(),
    slug: text('slug').unique().notNull(),
    status: categoryStatus('status').notNull().default('active'),
    description: text('description'),
    /** Cleared, not cascaded, if the file row ever goes: a category outlives its picture. */
    imageFileId: uuid('image_file_id').references(() => file.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index('category_status_idx').on(t.status)],
);

export const productStatus = pgEnum('product_status', PRODUCT_STATUSES);

export const product = pgTable(
  'product',
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text('name').notNull(),
    slug: text('slug').unique().notNull(),
    description: text('description'),
    /** Unique when set. Postgres treats NULLs as distinct, so many products can have none. */
    code: text('code').unique(),
    /** `restrict`: deleting a category that still has products must fail, not orphan or delete them. */
    categoryId: uuid('category_id')
      .notNull()
      .references(() => category.id, { onDelete: 'restrict' }),
    status: productStatus('status').notNull().default('active'),
    /** Cleared, not cascaded, if the file row ever goes: a product outlives its picture. */
    imageFileId: uuid('image_file_id').references(() => file.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  // Postgres does not index foreign keys itself. This serves the category filter
  // and the restrict check when a category is deleted.
  (t) => [index('product_category_id_idx').on(t.categoryId)],
);

/**
 * A dimension a product varies along — "Хэмжээ" with values 24см, 28см. At most
 * three per product (Shopify's model), with `position` 1–3 naming which of a
 * variant's `option1`…`option3` columns holds its value.
 *
 * Nothing references these rows: variants store the value labels themselves.
 * So re-saving a product can replace its options wholesale, and a variant that
 * was archived keeps its labels even after the option it came from is gone.
 */
export const productOption = pgTable(
  'product_option',
  {
    id: uuid().primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => product.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    position: smallint('position').notNull(),
    /** In display order. */
    values: text('values').array().notNull(),
  },
  (t) => [
    unique('product_option_position_unique').on(t.productId, t.position),
    unique('product_option_name_unique').on(t.productId, t.name),
    check('product_option_position_range', sql`${t.position} between 1 and 3`),
    check('product_option_has_values', sql`cardinality(${t.values}) > 0`),
  ],
);

/**
 * One sellable combination — "Хайруулын таваг / 28см / Улаан". SKU, price and
 * stock belong here, not to the product.
 *
 * A variant with stock history is archived rather than deleted when it is
 * removed from its product, because the ledger rows pointing at it are the
 * record of where stock went. Archived variants are invisible to every
 * uniqueness rule below, so their combination and SKU can be used again.
 */
export const variant = pgTable(
  'variant',
  {
    id: uuid().primaryKey().defaultRandom(),
    /** Cascade: the rows go with the product. A product with stock history cannot be deleted (see `stockLedger`). */
    productId: uuid('product_id')
      .notNull()
      .references(() => product.id, { onDelete: 'cascade' }),
    sku: text('sku'),
    /** Labels from the product's options at positions 1–3. All null for the single variant of a product without options. */
    option1: text('option1'),
    option2: text('option2'),
    option3: text('option3'),
    /** Display order within the product. */
    position: integer('position').notNull().default(0),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index('variant_product_id_idx').on(t.productId),
    uniqueIndex('variant_sku_unique')
      .on(t.sku)
      .where(sql`${t.archivedAt} is null`),
    // One live variant per combination. coalesce because NULLs are distinct in a
    // unique index, and a product with no options would otherwise allow many
    // all-null variants. Labels are never empty, so '' cannot collide with one.
    uniqueIndex('variant_combination_unique')
      .on(
        t.productId,
        sql`coalesce(${t.option1}, '')`,
        sql`coalesce(${t.option2}, '')`,
        sql`coalesce(${t.option3}, '')`,
      )
      .where(sql`${t.archivedAt} is null`),
    // Options fill from position 1: no option2 without an option1, and so on.
    check(
      'variant_options_contiguous',
      sql`(${t.option2} is null or ${t.option1} is not null) and (${t.option3} is null or ${t.option2} is not null)`,
    ),
  ],
);

/**
 * Prices are rows, never updated in place. The price at time T is the row with
 * valid_from <= T < valid_to (or valid_to null). Changing a price closes the open
 * row and opens a new one, so "what did this cost last month" stays answerable.
 */
export const price = pgTable(
  'price',
  {
    id: uuid().primaryKey().defaultRandom(),
    /**
     * Cascade: only a variant with no stock history is ever hard-deleted, and then
     * its prices have nothing left to explain. Once orders reference prices, those
     * references will be `restrict`.
     */
    variantId: uuid('variant_id')
      .notNull()
      .references(() => variant.id, { onDelete: 'cascade' }),
    /** Whole tögrög. */
    amount: integer('amount').notNull(),
    /** The struck-through "was" price, if the variant is on sale. */
    compareAtAmount: integer('compare_at_amount'),
    validFrom: timestamp('valid_from', { withTimezone: true }).notNull().defaultNow(),
    /** null = in effect now. */
    validTo: timestamp('valid_to', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // The invariant: at most one price in effect per variant.
    uniqueIndex('price_one_open_per_variant')
      .on(t.variantId)
      .where(sql`${t.validTo} is null`),
    index('price_variant_valid_from_idx').on(t.variantId, t.validFrom),
    check('price_amount_non_negative', sql`${t.amount} >= 0`),
    check(
      'price_compare_at_higher',
      sql`${t.compareAtAmount} is null or ${t.compareAtAmount} > ${t.amount}`,
    ),
    check('price_range_valid', sql`${t.validTo} is null or ${t.validTo} > ${t.validFrom}`),
  ],
);
