import { pgTable, text, uuid, timestamp } from 'drizzle-orm/pg-core';

/** A shopper orders are placed for. Created by staff; no sign-in yet. */
export const customer = pgTable('customer', {
  id: uuid().primaryKey().defaultRandom(),
  name: text('name').notNull(),
  /** Stored as `phoneSchema` normalises it: digits, with an optional leading `+`. */
  phone: text('phone').unique().notNull(),
  /** Unique when set. Postgres treats NULLs as distinct, so many customers can have none. */
  email: text('email').unique(),
  address: text('address'),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
