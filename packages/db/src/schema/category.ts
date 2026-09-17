import { pgTable, text, uuid, timestamp } from 'drizzle-orm/pg-core';

export const category = pgTable('category', {
  id: uuid().primaryKey().defaultRandom(),
  name: text('name').unique().notNull(),
  slug: text('slug').unique().notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
