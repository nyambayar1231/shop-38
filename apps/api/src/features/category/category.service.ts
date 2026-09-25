import { eq, getTableColumns } from 'drizzle-orm';
import { schema } from '@shop-38/db';
import type { Database } from '@shop-38/db';
import type { CreateCategoryInput, UpdateCategoryInput } from '@shop-38/contracts';
import { insertWithDerivedSlug } from '../../lib/derived-slug.js';
import { assertUploadedImage } from '../file/file.service.js';
import { isSlugConflict } from './category.errors.js';

/** Names that transliterate to nothing (punctuation, emoji, CJK) still need a URL. */
const FALLBACK_SLUG = 'category';

/** Every category read goes through here, so each response carries its image URL. */
const selectCategories = (db: Database) =>
  db
    .select({ ...getTableColumns(schema.category), imageUrl: schema.file.url })
    .from(schema.category)
    .leftJoin(schema.file, eq(schema.category.imageFileId, schema.file.id));

export const listCategories = (db: Database) =>
  selectCategories(db).orderBy(schema.category.name);

export const getCategoryById = async (db: Database, id: string) => {
  const [row] = await selectCategories(db).where(eq(schema.category.id, id));
  return row;
};

const insertCategory = async (db: Database, values: CreateCategoryInput & { slug: string }) => {
  const [row] = await db
    .insert(schema.category)
    .values(values)
    .returning({ id: schema.category.id });
  return row;
};

export const createCategory = async (db: Database, input: CreateCategoryInput) => {
  await assertUploadedImage(db, input.imageFileId);
  // An explicit slug is the caller claiming a specific URL: store it as given and
  // let a collision surface, rather than quietly handing them a different one.
  const { id } = input.slug
    ? await insertCategory(db, { ...input, slug: input.slug })
    : await insertWithDerivedSlug(
        input.name,
        FALLBACK_SLUG,
        (slug) => insertCategory(db, { ...input, slug }),
        isSlugConflict,
      );
  // Re-read rather than use `returning()`, so the response has `imageUrl` like every other read.
  const category = await getCategoryById(db, id);
  if (!category) throw new Error(`category ${id} disappeared right after insert`);
  return category;
};

export const updateCategory = async (db: Database, id: string, input: UpdateCategoryInput) => {
  // `updateCategorySchema` is fully partial, so an edit that changed nothing is a
  // valid `{}` — which drizzle would reject as "No values to set".
  if (Object.keys(input).length === 0) return getCategoryById(db, id);

  await assertUploadedImage(db, input.imageFileId);
  const [row] = await db
    .update(schema.category)
    .set(input)
    .where(eq(schema.category.id, id))
    .returning({ id: schema.category.id });
  return row && getCategoryById(db, row.id);
};

export const deleteCategory = async (db: Database, id: string) => {
  const [row] = await db.delete(schema.category).where(eq(schema.category.id, id)).returning();
  return row;
};
