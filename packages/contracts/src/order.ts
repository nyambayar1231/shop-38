import { z } from 'zod';
import { ORDER_STATUSES } from './enums.js';

// ---------------------------------------------------------------------------
// Orders.
//
// The client says which variants and how many. Everything else on a line —
// product name, code, SKU, option labels, unit price — the API copies from the
// catalog at the moment the order is placed, so the order keeps saying what was
// sold and for how much even after the product is renamed, repriced or deleted.
// ---------------------------------------------------------------------------

export const MAX_ORDER_ITEMS = 100;

/** A sanity limit, not a business rule. */
export const MAX_ORDER_QUANTITY = 10_000;

export const orderItemSchema = z.object({
  variantId: z.uuid(),
  quantity: z.int().min(1).max(MAX_ORDER_QUANTITY),
});

export type OrderItemInput = z.infer<typeof orderItemSchema>;

export const createOrderSchema = z
  .object({
    items: z.array(orderItemSchema).min(1).max(MAX_ORDER_ITEMS),
    note: z.string().trim().max(1000).nullish(),
  })
  .strict()
  .superRefine(({ items }, ctx) => {
    // One line per variant: two lines of the same thing is a quantity of two.
    const seen = new Set<string>();
    items.forEach((item, i) => {
      if (seen.has(item.variantId)) {
        ctx.addIssue({ code: 'custom', path: ['items', i, 'variantId'], message: 'duplicate_variant' });
      }
      seen.add(item.variantId);
    });
  });

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

/** Only a `pending` order can move, and only to one of the final statuses. */
export const updateOrderStatusSchema = z
  .object({
    status: z.enum(ORDER_STATUSES).exclude(['pending']),
  })
  .strict();

export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;

export const orderIdParamSchema = z.object({
  id: z.uuid(),
});

export const listOrdersQuerySchema = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
});
