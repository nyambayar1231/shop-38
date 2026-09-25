import { pgTable, text, uuid, timestamp, index } from 'drizzle-orm/pg-core';
import { category } from './category.js';
import { file } from './file.js';

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
