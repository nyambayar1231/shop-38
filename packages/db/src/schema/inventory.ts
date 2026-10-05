import { sql } from 'drizzle-orm';
import { pgTable, text, uuid, timestamp, index, pgEnum, integer, check } from 'drizzle-orm/pg-core';
import { STOCK_REASONS } from '@shop-38/contracts';
import { variant } from './catalog.js';

export const stockReason = pgEnum('stock_reason', STOCK_REASONS);

/**
 * Append-only: never updated, never deleted. A variant's stock on hand is
 * SUM(quantity) over its rows. There is deliberately no stored counter — it
 * would be a second, weaker record of a fact this table already holds, and the
 * two would eventually disagree.
 */
export const stockLedger = pgTable(
  'stock_ledger',
  {
    id: uuid().primaryKey().defaultRandom(),
    /**
     * `restrict`: history outlives the catalog. Removing a variant with movements
     * archives it instead, and a product with any cannot be deleted — archive it.
     */
    variantId: uuid('variant_id')
      .notNull()
      .references(() => variant.id, { onDelete: 'restrict' }),
    /** Signed: +12 received, -1 damaged. */
    quantity: integer('quantity').notNull(),
    reason: stockReason('reason').notNull(),
    note: text('note'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Serves both the SUM for stock on hand and a variant's history, newest first.
    index('stock_ledger_variant_occurred_at_idx').on(t.variantId, t.occurredAt),
    check('stock_ledger_quantity_nonzero', sql`${t.quantity} <> 0`),
  ],
);
