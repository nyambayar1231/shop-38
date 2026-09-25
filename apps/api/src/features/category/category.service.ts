import { eq } from 'drizzle-orm';
import { schema } from '@shop-38/db';
import type { Database } from '@shop-38/db';
import { slugify, slugWithSuffix } from '@shop-38/contracts';
import type { CreateCategoryInput, UpdateCategoryInput } from '@shop-38/contracts';
import { isSlugConflict } from './category.errors.js';

/**
 * Two categories can easily transliterate alike, so a derived slug retries with a
 * numeric suffix rather than failing — the same thing Shopify, WooCommerce and
 * Magento do. The cap is a safety net; needing this many means something is wrong.
 */
const MAX_SLUG_ATTEMPTS = 10;

/** Names that transliterate to nothing (punctuation, emoji, CJK) still need a URL. */
const FALLBACK_SLUG = 'category';

export const listCategories = (db: Database) =>
  db.select().from(schema.category).orderBy(schema.category.name);

export const getCategoryById = async (db: Database, id: string) => {
  const [row] = await db.select().from(schema.category).where(eq(schema.category.id, id));
  return row;
};

const insertCategory = async (db: Database, values: CreateCategoryInput & { slug: string }) => {
  const [row] = await db.insert(schema.category).values(values).returning();
  return row;
};

export const createCategory = async (db: Database, input: CreateCategoryInput) => {
  // An explicit slug is the caller claiming a specific URL: store it as given and
  // let a collision surface, rather than quietly handing them a different one.
  if (input.slug) return insertCategory(db, { ...input, slug: input.slug });

  const base = slugify(input.name) || FALLBACK_SLUG;
  for (let attempt = 1; attempt <= MAX_SLUG_ATTEMPTS; attempt++) {
    try {
      return await insertCategory(db, { ...input, slug: slugWithSuffix(base, attempt) });
    } catch (error) {
      // A duplicate *name* is a real conflict and must not be retried.
      if (!isSlugConflict(error)) throw error;
    }
  }
  throw new Error(`could not derive a free slug from "${base}"`);
};

export const updateCategory = async (db: Database, id: string, input: UpdateCategoryInput) => {
  // `updateCategorySchema` is fully partial, so an edit that changed nothing is a
  // valid `{}` — which drizzle would reject as "No values to set".
  if (Object.keys(input).length === 0) return getCategoryById(db, id);

  const [row] = await db
    .update(schema.category)
    .set(input)
    .where(eq(schema.category.id, id))
    .returning();
  return row;
};

export const deleteCategory = async (db: Database, id: string) => {
  const [row] = await db.delete(schema.category).where(eq(schema.category.id, id)).returning();
  return row;
};
