import { pgTable, text, uuid, timestamp, index, pgEnum } from 'drizzle-orm/pg-core';
import { CATEGORY_STATUSES } from '@shop-38/contracts';

export const categoryStatus = pgEnum('category_status', CATEGORY_STATUSES);

export const category = pgTable(
  'category',
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text('name').unique().notNull(),
    slug: text('slug').unique().notNull(),
    status: categoryStatus('status').notNull().default('active'),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index('category_status_idx').on(t.status)],
);
