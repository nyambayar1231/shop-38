import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { schema } from '@shop-38/db';
import type { Database } from '@shop-38/db';
import type { ChangeVariantPriceInput } from '@shop-38/contracts';
import { isCurrentPrice, optionValuesOf } from '../product/product.service.js';

const HISTORY_LIMIT = 200;

export const listPrices = (db: Database, variantId: string) =>
  db
    .select({
      id: schema.price.id,
      amount: schema.price.amount,
      compareAtAmount: schema.price.compareAtAmount,
      validFrom: schema.price.validFrom,
      validTo: schema.price.validTo,
    })
    .from(schema.price)
    .where(eq(schema.price.variantId, variantId))
    .orderBy(desc(schema.price.validFrom))
    .limit(HISTORY_LIMIT);

/** One live variant, with what its page shows at the top: product, current price. */
export const getVariantById = async (db: Database, id: string) => {
  const [row] = await db
    .select({
      id: schema.variant.id,
      sku: schema.variant.sku,
      option1: schema.variant.option1,
      option2: schema.variant.option2,
      option3: schema.variant.option3,
      price: schema.price.amount,
      product: {
        id: schema.product.id,
        name: schema.product.name,
        status: schema.product.status,
      },
    })
    .from(schema.variant)
    .innerJoin(schema.product, eq(schema.variant.productId, schema.product.id))
    .leftJoin(schema.price, isCurrentPrice)
    .where(and(eq(schema.variant.id, id), isNull(schema.variant.archivedAt)));
  if (!row) return undefined;
  const { option1, option2, option3, ...rest } = row;
  return { ...rest, optionValues: optionValuesOf({ option1, option2, option3 }) };
};

/**
 * Closes the open price row and opens a new one — never an UPDATE of an amount.
 * Both carry the transaction's now(), so the history has no gap and no overlap.
 *
 * Returns `undefined` if there is no such live variant.
 */
export const changeVariantPrice = (
  db: Database,
  variantId: string,
  input: ChangeVariantPriceInput,
) =>
  db.transaction(async (tx) => {
    // Locks the variant, so two concurrent repricings queue instead of both
    // closing the same row and one dying on price_one_open_per_variant.
    const [variant] = await tx
      .select({ id: schema.variant.id })
      .from(schema.variant)
      .where(and(eq(schema.variant.id, variantId), isNull(schema.variant.archivedAt)))
      .for('update');
    if (!variant) return undefined;

    await tx
      .update(schema.price)
      .set({ validTo: sql`now()` })
      .where(and(eq(schema.price.variantId, variantId), isNull(schema.price.validTo)));
    const [price] = await tx
      .insert(schema.price)
      .values({ variantId, amount: input.price })
      .returning({
        id: schema.price.id,
        amount: schema.price.amount,
        compareAtAmount: schema.price.compareAtAmount,
        validFrom: schema.price.validFrom,
        validTo: schema.price.validTo,
      });
    return price!;
  });

export const variantExists = async (db: Database, id: string) => {
  const [row] = await db
    .select({ id: schema.variant.id })
    .from(schema.variant)
    .where(eq(schema.variant.id, id));
  return Boolean(row);
};
