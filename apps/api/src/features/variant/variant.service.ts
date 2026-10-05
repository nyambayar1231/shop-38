import { and, asc, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { schema } from '@shop-38/db';
import type { Database } from '@shop-38/db';
import type { ChangeVariantPriceInput, CreateStockMovementInput } from '@shop-38/contracts';
import { isCurrentPrice, optionValuesOf, stockOnHand } from '../product/product.service.js';

/** Enough for any shop this admin is built for; past that it wants paging. */
const INVENTORY_LIMIT = 500;
const HISTORY_LIMIT = 200;

/** `%` and `_` in what the user typed are literal characters, not wildcards. */
const escapeLike = (value: string) => value.replace(/[\\%_]/g, (char) => `\\${char}`);

/** Every live variant of every product that is not archived, with its stock: the inventory view. */
export const listVariants = async (db: Database, { search }: { search?: string }) => {
  const pattern = search ? `%${escapeLike(search)}%` : undefined;
  const rows = await db
    .select({
      id: schema.variant.id,
      sku: schema.variant.sku,
      option1: schema.variant.option1,
      option2: schema.variant.option2,
      option3: schema.variant.option3,
      price: schema.price.amount,
      stock: stockOnHand,
      product: {
        id: schema.product.id,
        name: schema.product.name,
        status: schema.product.status,
      },
      imageUrl: schema.file.url,
    })
    .from(schema.variant)
    .innerJoin(schema.product, eq(schema.variant.productId, schema.product.id))
    .leftJoin(schema.file, eq(schema.product.imageFileId, schema.file.id))
    .leftJoin(schema.price, isCurrentPrice)
    .where(
      and(
        isNull(schema.variant.archivedAt),
        sql`${schema.product.status} <> 'archived'`,
        pattern
          ? or(ilike(schema.product.name, pattern), ilike(schema.variant.sku, pattern))
          : undefined,
      ),
    )
    .orderBy(asc(schema.product.name), asc(schema.variant.position))
    .limit(INVENTORY_LIMIT);

  return rows.map(({ option1, option2, option3, ...rest }) => ({
    ...rest,
    optionValues: optionValuesOf({ option1, option2, option3 }),
  }));
};

/** Newest first: the admin reads it to answer "where did these go?". */
export const listStockMovements = (db: Database, variantId: string) =>
  db
    .select({
      id: schema.stockLedger.id,
      quantity: schema.stockLedger.quantity,
      reason: schema.stockLedger.reason,
      note: schema.stockLedger.note,
      occurredAt: schema.stockLedger.occurredAt,
    })
    .from(schema.stockLedger)
    .where(eq(schema.stockLedger.variantId, variantId))
    .orderBy(desc(schema.stockLedger.occurredAt), desc(schema.stockLedger.createdAt))
    .limit(HISTORY_LIMIT);

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

/** One live variant, with what its page shows at the top: product, current price, stock. */
export const getVariantById = async (db: Database, id: string) => {
  const [row] = await db
    .select({
      id: schema.variant.id,
      sku: schema.variant.sku,
      option1: schema.variant.option1,
      option2: schema.variant.option2,
      option3: schema.variant.option3,
      price: schema.price.amount,
      stock: stockOnHand,
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

const insufficientStock = (stock: number) =>
  new HTTPException(422, {
    res: Response.json({ error: 'insufficient_stock', stock }, { status: 422 }),
  });

/**
 * Appends one movement and returns it with the resulting stock. Stock may not go
 * below zero: you cannot write off units you do not have.
 *
 * Returns `undefined` if there is no such live variant.
 */
export const createStockMovement = (
  db: Database,
  variantId: string,
  input: CreateStockMovementInput,
) =>
  db.transaction(async (tx) => {
    // Locking the variant serialises movements on it, so two concurrent write-offs
    // cannot both pass the check against the same stock and take it negative.
    const [variant] = await tx
      .select({ id: schema.variant.id })
      .from(schema.variant)
      .where(and(eq(schema.variant.id, variantId), isNull(schema.variant.archivedAt)))
      .for('update');
    if (!variant) return undefined;

    const [{ stock }] = (await tx
      .select({ stock: stockOnHand })
      .from(schema.variant)
      .where(eq(schema.variant.id, variantId))) as [{ stock: number }];
    if (stock + input.quantity < 0) throw insufficientStock(stock);

    const [movement] = await tx
      .insert(schema.stockLedger)
      .values({
        variantId,
        quantity: input.quantity,
        reason: input.reason,
        note: input.note ?? null,
      })
      .returning({
        id: schema.stockLedger.id,
        quantity: schema.stockLedger.quantity,
        reason: schema.stockLedger.reason,
        note: schema.stockLedger.note,
        occurredAt: schema.stockLedger.occurredAt,
      });
    return { movement: movement!, stock: stock + input.quantity };
  });
