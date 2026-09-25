import { eq, getTableColumns } from 'drizzle-orm';
import { schema } from '@shop-38/db';
import type { Database } from '@shop-38/db';
import type { CreateProductInput, UpdateProductInput } from '@shop-38/contracts';
import { insertWithDerivedSlug } from '../../lib/derived-slug.js';
import { assertUploadedImage } from '../file/file.service.js';
import { isSlugConflict } from './product.errors.js';

/** Names that transliterate to nothing (punctuation, emoji, CJK) still need a URL. */
const FALLBACK_SLUG = 'product';

/** Every product read goes through here, so each response names its category and image URL. */
const selectProducts = (db: Database) =>
  db
    .select({
      ...getTableColumns(schema.product),
      category: { id: schema.category.id, name: schema.category.name },
      imageUrl: schema.file.url,
    })
    .from(schema.product)
    .innerJoin(schema.category, eq(schema.product.categoryId, schema.category.id))
    .leftJoin(schema.file, eq(schema.product.imageFileId, schema.file.id));

export const listProducts = (db: Database, filter: { categoryId?: string }) => {
  const query = selectProducts(db);
  return (
    filter.categoryId ? query.where(eq(schema.product.categoryId, filter.categoryId)) : query
  ).orderBy(schema.product.name);
};

export const getProductById = async (db: Database, id: string) => {
  const [row] = await selectProducts(db).where(eq(schema.product.id, id));
  return row;
};

const insertProduct = async (db: Database, values: CreateProductInput & { slug: string }) => {
  const [row] = await db
    .insert(schema.product)
    .values(values)
    .returning({ id: schema.product.id });
  return row;
};

export const createProduct = async (db: Database, input: CreateProductInput) => {
  await assertUploadedImage(db, input.imageFileId);
  // An explicit slug is the caller claiming a specific URL: store it as given and
  // let a collision surface, rather than quietly handing them a different one.
  const { id } = input.slug
    ? await insertProduct(db, { ...input, slug: input.slug })
    : await insertWithDerivedSlug(
        input.name,
        FALLBACK_SLUG,
        (slug) => insertProduct(db, { ...input, slug }),
        isSlugConflict,
      );
  // Re-read rather than use `returning()`, so the response has `category` like every other read.
  const product = await getProductById(db, id);
  if (!product) throw new Error(`product ${id} disappeared right after insert`);
  return product;
};

export const updateProduct = async (db: Database, id: string, input: UpdateProductInput) => {
  // `updateProductSchema` is fully partial, so an edit that changed nothing is a
  // valid `{}` — which drizzle would reject as "No values to set".
  if (Object.keys(input).length === 0) return getProductById(db, id);

  await assertUploadedImage(db, input.imageFileId);
  const [row] = await db
    .update(schema.product)
    .set(input)
    .where(eq(schema.product.id, id))
    .returning({ id: schema.product.id });
  return row && getProductById(db, row.id);
};

export const deleteProduct = async (db: Database, id: string) => {
  const [row] = await db
    .delete(schema.product)
    .where(eq(schema.product.id, id))
    .returning({ id: schema.product.id });
  return row;
};
