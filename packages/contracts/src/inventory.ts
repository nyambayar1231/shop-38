import { z } from 'zod';
import { MANUAL_STOCK_REASONS } from './enums.js';

/** Receipts and returns bring stock in, damage and loss take it out; a correction goes either way. */
const REASON_SIGN: Record<(typeof MANUAL_STOCK_REASONS)[number], 1 | -1 | 0> = {
  receipt: 1,
  return: 1,
  damage: -1,
  loss: -1,
  correction: 0,
};

/**
 * A manual change to one variant's stock. The ledger stores the signed change,
 * never an absolute count, so every unit on hand can be traced to why it is there.
 */
export const createStockMovementSchema = z
  .object({
    /** Signed: `+12` received, `-1` damaged. Zero records nothing and is rejected. */
    quantity: z
      .int()
      .min(-1_000_000)
      .max(1_000_000)
      .refine((n) => n !== 0, 'quantity_zero'),
    reason: z.enum(MANUAL_STOCK_REASONS),
    note: z.string().trim().max(300).nullish(),
  })
  .refine(
    ({ quantity, reason }) =>
      REASON_SIGN[reason] === 0 || Math.sign(quantity) === REASON_SIGN[reason],
    { path: ['quantity'], message: 'sign_mismatch' },
  );

export type CreateStockMovementInput = z.infer<typeof createStockMovementSchema>;

export const variantIdParamSchema = z.object({
  id: z.uuid(),
});

export const listVariantsQuerySchema = z.object({
  /** Matches product name or SKU, case-insensitively. */
  search: z.string().trim().max(100).optional(),
});
