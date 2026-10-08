import { sql } from 'drizzle-orm';
import { pgTable, text, uuid, timestamp, index, pgEnum, integer, check } from 'drizzle-orm/pg-core';
import { ORDER_STATUSES } from '@shop-38/contracts';
import { product, variant } from './catalog.js';
import { customer } from './customer.js';

export const orderStatus = pgEnum('order_status', ORDER_STATUSES);

export const order = pgTable(
  'order',
  {
    id: uuid().primaryKey().defaultRandom(),
    /** What staff say out loud: "захиалга 1024". Never reused, gaps allowed. */
    number: integer('number').generatedAlwaysAsIdentity({ startWith: 1001 }).unique().notNull(),
    /** `restrict`: a customer with orders cannot be deleted out from under them. */
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customer.id, { onDelete: 'restrict' }),
    status: orderStatus('status').notNull().default('pending'),
    note: text('note'),
    /** Whole tögrög. The sum of its items' unit price × quantity, fixed when the order is placed. */
    totalAmount: integer('total_amount').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index('order_status_idx').on(t.status),
    index('order_customer_id_idx').on(t.customerId),
    index('order_created_at_idx').on(t.createdAt),
    check('order_total_non_negative', sql`${t.totalAmount} >= 0`),
  ],
);

/**
 * One line of an order. Everything shown about it is a copy taken when the order
 * was placed, so the line outlives changes to the catalog. The references are
 * only links back: `set null`, so deleting a product or variant never has to ask
 * the orders first.
 */
export const orderItem = pgTable(
  'order_item',
  {
    id: uuid().primaryKey().defaultRandom(),
    /** Cascade: the lines go with the order. */
    orderId: uuid('order_id')
      .notNull()
      .references(() => order.id, { onDelete: 'cascade' }),
    productId: uuid('product_id').references(() => product.id, { onDelete: 'set null' }),
    variantId: uuid('variant_id').references(() => variant.id, { onDelete: 'set null' }),
    productName: text('product_name').notNull(),
    productCode: text('product_code'),
    sku: text('sku'),
    /** The variant's option labels at the time, in order. Empty for a product without options. */
    optionValues: text('option_values').array().notNull().default(sql`'{}'::text[]`),
    /** Whole tögrög, per unit. */
    unitPrice: integer('unit_price').notNull(),
    quantity: integer('quantity').notNull(),
    /** Display order within the order. */
    position: integer('position').notNull().default(0),
  },
  (t) => [
    index('order_item_order_id_idx').on(t.orderId),
    // Postgres does not index foreign keys itself; these serve `set null` on delete.
    index('order_item_product_id_idx').on(t.productId),
    index('order_item_variant_id_idx').on(t.variantId),
    check('order_item_quantity_positive', sql`${t.quantity} > 0`),
    check('order_item_unit_price_non_negative', sql`${t.unitPrice} >= 0`),
  ],
);
