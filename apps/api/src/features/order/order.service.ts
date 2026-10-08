import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { schema } from '@shop-38/db';
import type { Database, Executor } from '@shop-38/db';
import type {
  CreateOrderInput,
  OrderStatus,
  UpdateOrderStatusInput,
} from '@shop-38/contracts';
import { isCurrentPrice, optionValuesOf } from '../product/product.service.js';
import { unavailableVariants } from './order.errors.js';

const LIST_LIMIT = 500;

// ---------------------------------------------------------------------------
// Reads.
// ---------------------------------------------------------------------------

const orderColumns = {
  id: schema.order.id,
  number: schema.order.number,
  status: schema.order.status,
  note: schema.order.note,
  totalAmount: schema.order.totalAmount,
  createdAt: schema.order.createdAt,
  updatedAt: schema.order.updatedAt,
};

/** Newest first, each with how many lines and units it has, for the admin list. */
export const listOrders = (db: Database, filter: { status?: OrderStatus }) =>
  db
    .select({
      ...orderColumns,
      itemCount: sql<number>`count(${schema.orderItem.id})::int`,
      quantity: sql<number>`coalesce(sum(${schema.orderItem.quantity}), 0)::int`,
    })
    .from(schema.order)
    .leftJoin(schema.orderItem, eq(schema.orderItem.orderId, schema.order.id))
    .where(filter.status ? eq(schema.order.status, filter.status) : undefined)
    .groupBy(schema.order.id)
    .orderBy(desc(schema.order.createdAt))
    .limit(LIST_LIMIT);

/** An order with its lines in the order they were entered. */
export const getOrderById = async (db: Executor, id: string) => {
  const [found] = await db.select(orderColumns).from(schema.order).where(eq(schema.order.id, id));
  if (!found) return undefined;

  const items = await db
    .select({
      id: schema.orderItem.id,
      productId: schema.orderItem.productId,
      variantId: schema.orderItem.variantId,
      productName: schema.orderItem.productName,
      productCode: schema.orderItem.productCode,
      sku: schema.orderItem.sku,
      optionValues: schema.orderItem.optionValues,
      unitPrice: schema.orderItem.unitPrice,
      quantity: schema.orderItem.quantity,
    })
    .from(schema.orderItem)
    .where(eq(schema.orderItem.orderId, id))
    .orderBy(asc(schema.orderItem.position));
  return {
    ...found,
    items: items.map((item) => ({ ...item, lineTotal: item.unitPrice * item.quantity })),
  };
};

// ---------------------------------------------------------------------------
// Writes.
// ---------------------------------------------------------------------------

/**
 * Prices each line from the catalog as it stands now and writes the order and
 * its lines in one transaction. A variant that is archived, gone, has no price,
 * or belongs to an archived product cannot be ordered: the whole order is
 * refused, naming every such variant.
 */
export const createOrder = async (db: Database, input: CreateOrderInput) => {
  const id = await db.transaction(async (tx) => {
    const variantIds = input.items.map((item) => item.variantId);
    // `for share` on the variant: it cannot be deleted or repriced half-way
    // through, so the price copied is the one in effect when the order commits.
    const rows = await tx
      .select({
        variantId: schema.variant.id,
        productId: schema.product.id,
        productName: schema.product.name,
        productCode: schema.product.code,
        productStatus: schema.product.status,
        sku: schema.variant.sku,
        option1: schema.variant.option1,
        option2: schema.variant.option2,
        option3: schema.variant.option3,
        price: schema.price.amount,
      })
      .from(schema.variant)
      .innerJoin(schema.product, eq(schema.variant.productId, schema.product.id))
      .leftJoin(schema.price, isCurrentPrice)
      .where(and(inArray(schema.variant.id, variantIds), isNull(schema.variant.archivedAt)))
      .for('share', { of: schema.variant });
    const byId = new Map(rows.map((row) => [row.variantId, row]));

    const unavailable = variantIds.filter((variantId) => {
      const row = byId.get(variantId);
      return !row || row.price === null || row.productStatus === 'archived';
    });
    if (unavailable.length > 0) throw unavailableVariants(unavailable);

    const lines = input.items.map((item, position) => {
      const row = byId.get(item.variantId)!;
      return {
        productId: row.productId,
        variantId: row.variantId,
        productName: row.productName,
        productCode: row.productCode,
        sku: row.sku,
        optionValues: optionValuesOf(row),
        unitPrice: row.price!,
        quantity: item.quantity,
        position,
      };
    });
    const totalAmount = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);

    const [created] = await tx
      .insert(schema.order)
      .values({ note: input.note ?? null, totalAmount })
      .returning({ id: schema.order.id });
    await tx.insert(schema.orderItem).values(lines.map((line) => ({ ...line, orderId: created!.id })));
    return created!.id;
  });

  const created = await getOrderById(db, id);
  if (!created) throw new Error(`order ${id} disappeared right after insert`);
  return created;
};

/**
 * Moves a `pending` order to a final status. Returns `'not_found'` if there is
 * no such order, `'not_pending'` if it has already been completed or cancelled.
 */
export const updateOrderStatus = async (db: Database, id: string, input: UpdateOrderStatusInput) => {
  const [row] = await db
    .update(schema.order)
    .set({ status: input.status })
    .where(and(eq(schema.order.id, id), eq(schema.order.status, 'pending')))
    .returning({ id: schema.order.id });
  if (row) return (await getOrderById(db, row.id))!;

  const [exists] = await db
    .select({ id: schema.order.id })
    .from(schema.order)
    .where(eq(schema.order.id, id));
  return exists ? ('not_pending' as const) : ('not_found' as const);
};
