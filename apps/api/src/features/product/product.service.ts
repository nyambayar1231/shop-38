import { and, asc, eq, getTableColumns, inArray, isNull, sql, type SQL } from 'drizzle-orm';
import { schema } from '@shop-38/db';
import type { Database, Executor, Tx } from '@shop-38/db';
import {
  variantCombinationKey,
  type CreateProductInput,
  type ProductOptionInput,
  type ProductVariantInput,
  type ProductStatus,
  type UpdateProductInput,
  type UpdateProductVariantsInput,
} from '@shop-38/contracts';
import { insertWithDerivedSlug } from '../../lib/derived-slug.js';
import { assertUploadedImage } from '../file/file.service.js';
import { isSlugConflict, unknownVariant } from './product.errors.js';

/** Names that transliterate to nothing (punctuation, emoji, CJK) still need a URL. */
const FALLBACK_SLUG = 'product';

// ---------------------------------------------------------------------------
// Reads.
// ---------------------------------------------------------------------------

/** Every product read goes through here, so each response names its category and image URL. */
const selectProducts = (db: Executor) =>
  db
    .select({
      ...getTableColumns(schema.product),
      category: { id: schema.category.id, name: schema.category.name },
      imageUrl: schema.file.url,
    })
    .from(schema.product)
    .innerJoin(schema.category, eq(schema.product.categoryId, schema.category.id))
    .leftJoin(schema.file, eq(schema.product.imageFileId, schema.file.id));

/** The one price row in effect now. */
export const isCurrentPrice = and(
  eq(schema.price.variantId, schema.variant.id),
  isNull(schema.price.validTo),
);

/** Live variants with their current price. Archived ones exist only for their history. */
const selectVariants = (db: Executor, where: SQL | undefined) =>
  db
    .select({
      id: schema.variant.id,
      productId: schema.variant.productId,
      sku: schema.variant.sku,
      option1: schema.variant.option1,
      option2: schema.variant.option2,
      option3: schema.variant.option3,
      /** `null` only for a variant that predates prices and was never given one. */
      price: schema.price.amount,
      compareAtPrice: schema.price.compareAtAmount,
    })
    .from(schema.variant)
    .leftJoin(schema.price, isCurrentPrice)
    .where(and(isNull(schema.variant.archivedAt), where))
    .orderBy(asc(schema.variant.position), asc(schema.variant.createdAt));

type VariantRow = Awaited<ReturnType<typeof selectVariants>>[number];

export const optionValuesOf = (row: {
  option1: string | null;
  option2: string | null;
  option3: string | null;
}) => [row.option1, row.option2, row.option3].filter((value): value is string => value !== null);

const toVariant = ({ option1, option2, option3, productId: _, ...rest }: VariantRow) => ({
  ...rest,
  optionValues: optionValuesOf({ option1, option2, option3 }),
});

/**
 * What a product row in the admin list needs to say about its variants without
 * loading them: how many, and the price range.
 */
function summarize(variants: VariantRow[]) {
  const prices = variants.flatMap((v) => (v.price === null ? [] : [v.price]));
  return {
    variantCount: variants.length,
    minPrice: prices.length ? Math.min(...prices) : null,
    maxPrice: prices.length ? Math.max(...prices) : null,
  };
}

export const listProducts = async (
  db: Database,
  filter: { categoryId?: string; status?: ProductStatus },
) => {
  const products = await selectProducts(db)
    .where(
      and(
        filter.categoryId ? eq(schema.product.categoryId, filter.categoryId) : undefined,
        filter.status ? eq(schema.product.status, filter.status) : undefined,
      ),
    )
    .orderBy(schema.product.name);
  if (products.length === 0) return [];

  const variants = await selectVariants(
    db,
    inArray(
      schema.variant.productId,
      products.map((p) => p.id),
    ),
  );
  const byProduct = new Map<string, VariantRow[]>();
  for (const v of variants) byProduct.set(v.productId, [...(byProduct.get(v.productId) ?? []), v]);
  return products.map((product) => ({ ...product, ...summarize(byProduct.get(product.id) ?? []) }));
};

/** A product with everything the editor shows: options in order, and live variants in order. */
export const getProductById = async (db: Executor, id: string) => {
  const [product] = await selectProducts(db).where(eq(schema.product.id, id));
  if (!product) return undefined;

  const [options, variants] = await Promise.all([
    db
      .select({ name: schema.productOption.name, values: schema.productOption.values })
      .from(schema.productOption)
      .where(eq(schema.productOption.productId, id))
      .orderBy(schema.productOption.position),
    selectVariants(db, eq(schema.variant.productId, id)),
  ]);
  return { ...product, options, variants: variants.map(toVariant) };
};

// ---------------------------------------------------------------------------
// Writes.
// ---------------------------------------------------------------------------

const optionColumns = (values: readonly string[]) => ({
  option1: values[0] ?? null,
  option2: values[1] ?? null,
  option3: values[2] ?? null,
});

const insertOptions = async (tx: Tx, productId: string, options: ProductOptionInput[]) => {
  if (options.length === 0) return;
  await tx
    .insert(schema.productOption)
    .values(
      options.map((o, i) => ({ productId, name: o.name, values: o.values, position: i + 1 })),
    );
};

/**
 * New variants, and their opening prices, in two statements
 * whatever the count: over Hyperdrive every round trip costs, and a product can
 * have a hundred variants. Ids are made here so rows can be linked without
 * relying on the order `returning()` hands them back in.
 */
const insertVariants = async (
  tx: Tx,
  productId: string,
  variants: { input: ProductVariantInput; position: number }[],
) => {
  if (variants.length === 0) return;
  const rows = variants.map(({ input, position }) => ({
    id: crypto.randomUUID(),
    input,
    position,
  }));

  await tx.insert(schema.variant).values(
    rows.map(({ id, input, position }) => ({
      id,
      productId,
      sku: input.sku ?? null,
      position,
      ...optionColumns(input.optionValues),
    })),
  );
  await tx.insert(schema.price).values(
    rows.map(({ id, input }) => ({
      variantId: id,
      amount: input.price,
      compareAtAmount: input.compareAtPrice ?? null,
    })),
  );
};

const insertProduct = async (
  db: Executor,
  values: Omit<CreateProductInput, 'options' | 'variants'> & { slug: string },
) => {
  const [row] = await db.insert(schema.product).values(values).returning({ id: schema.product.id });
  return row!;
};

/** The product, its options, variants and prices: all of it, or none. */
export const createProduct = async (db: Database, input: CreateProductInput) => {
  await assertUploadedImage(db, input.imageFileId);
  const { options, variants, ...details } = input;

  const id = await db.transaction(async (tx) => {
    // An explicit slug is the caller claiming a specific URL: store it as given and
    // let a collision surface, rather than quietly handing them a different one.
    // A derived one retries — each attempt in a savepoint, because a failed
    // statement otherwise aborts the whole transaction.
    const { id } = details.slug
      ? await insertProduct(tx, { ...details, slug: details.slug })
      : await insertWithDerivedSlug(
          details.name,
          FALLBACK_SLUG,
          (slug) => tx.transaction((savepoint) => insertProduct(savepoint, { ...details, slug })),
          isSlugConflict,
        );
    await insertOptions(tx, id, options);
    await insertVariants(
      tx,
      id,
      variants.map((v, position) => ({ input: v, position })),
    );
    return id;
  });

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

/**
 * Makes the product's options and variants exactly `input`. Variants are matched
 * by `id`; a variant left out is deleted.
 * A price that differs from the current one closes that row and opens a new one.
 *
 * Returns `undefined` if there is no such product.
 */
export const updateProductVariants = async (
  db: Database,
  productId: string,
  input: UpdateProductVariantsInput,
) => {
  const found = await db.transaction(async (tx) => {
    // Locks the product, so two saves of the same product queue rather than
    // interleave their deletes and inserts.
    const [product] = await tx
      .select({ id: schema.product.id })
      .from(schema.product)
      .where(eq(schema.product.id, productId))
      .for('update');
    if (!product) return false;

    const current = await tx
      .select({
        id: schema.variant.id,
        sku: schema.variant.sku,
        option1: schema.variant.option1,
        option2: schema.variant.option2,
        option3: schema.variant.option3,
        priceId: schema.price.id,
        price: schema.price.amount,
        compareAtPrice: schema.price.compareAtAmount,
      })
      .from(schema.variant)
      .leftJoin(schema.price, isCurrentPrice)
      .where(and(eq(schema.variant.productId, productId), isNull(schema.variant.archivedAt)));
    const currentById = new Map(current.map((v) => [v.id, v]));

    const kept = input.variants.flatMap((v, position) => {
      if (!v.id) return [];
      const existing = currentById.get(v.id);
      if (!existing) throw unknownVariant();
      return [{ input: v, position, existing }];
    });
    const added = input.variants.flatMap((v, position) => (v.id ? [] : [{ input: v, position }]));

    // 1. Removed variants go first, freeing their combinations and SKUs.
    const keptIds = new Set(kept.map((k) => k.existing.id));
    const removedIds = current.filter((v) => !keptIds.has(v.id)).map((v) => v.id);
    if (removedIds.length > 0) {
      await tx.delete(schema.variant).where(inArray(schema.variant.id, removedIds));
    }

    // 2. Options are replaced wholesale: nothing references them.
    await tx.delete(schema.productOption).where(eq(schema.productOption.productId, productId));
    await insertOptions(tx, productId, input.options);

    // 3. Kept variants take their new combination, SKU and position in one
    // statement. Postgres checks unique indexes row by row, so two variants
    // swapping combinations (or SKUs) would collide half-way. Variants whose
    // identity changes are first parked on a placeholder no label can equal —
    // labels never contain control characters.
    if (kept.length > 0) {
      const moving = kept
        .filter(
          ({ input: v, existing }) =>
            (v.sku ?? null) !== existing.sku ||
            variantCombinationKey(v.optionValues) !==
              variantCombinationKey(optionValuesOf(existing)),
        )
        .map(({ existing }) => existing.id);
      if (moving.length > 0) {
        await tx
          .update(schema.variant)
          .set({
            sku: null,
            option1: sql`chr(10) || ${schema.variant.id}::text`,
            option2: null,
            option3: null,
          })
          .where(inArray(schema.variant.id, moving));
      }

      const values = kept.map(({ input: v, position, existing }) => {
        const o = optionColumns(v.optionValues);
        return sql`(${existing.id}::uuid, ${v.sku ?? null}::text, ${o.option1}::text, ${o.option2}::text, ${o.option3}::text, ${position}::int)`;
      });
      await tx.execute(sql`
        update ${schema.variant}
        set sku = d.sku, option1 = d.o1, option2 = d.o2, option3 = d.o3, position = d.pos, updated_at = now()
        from (values ${sql.join(values, sql`, `)}) as d(id, sku, o1, o2, o3, pos)
        where ${schema.variant.id} = d.id
      `);

      // 4. Repriced variants: close the open row, open a new one. Both carry the
      // transaction's now(), so the history has no gap and no overlap.
      const repriced = kept.filter(
        ({ input: v, existing }) =>
          v.price !== existing.price || (v.compareAtPrice ?? null) !== existing.compareAtPrice,
      );
      const closing = repriced.flatMap(({ existing }) =>
        existing.priceId ? [existing.priceId] : [],
      );
      if (closing.length > 0) {
        await tx
          .update(schema.price)
          .set({ validTo: sql`now()` })
          .where(inArray(schema.price.id, closing));
      }
      if (repriced.length > 0) {
        await tx.insert(schema.price).values(
          repriced.map(({ input: v, existing }) => ({
            variantId: existing.id,
            amount: v.price,
            compareAtAmount: v.compareAtPrice ?? null,
          })),
        );
      }
    }

    // 5. New variants, with opening prices.
    await insertVariants(tx, productId, added);
    return true;
  });

  return found ? getProductById(db, productId) : undefined;
};

export const deleteProduct = async (db: Database, id: string) => {
  const [row] = await db
    .delete(schema.product)
    .where(eq(schema.product.id, id))
    .returning({ id: schema.product.id });
  return row;
};
