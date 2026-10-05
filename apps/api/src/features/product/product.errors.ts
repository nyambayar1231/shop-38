import { HTTPException } from 'hono/http-exception';
import {
  FOREIGN_KEY_VIOLATION,
  UNIQUE_VIOLATION,
  violatedConstraint,
} from '../../lib/postgres-errors.js';

/** `product` is unique on `slug` and `code`; a live `variant` on `sku`. */
const conflictFieldByConstraint: Record<string, 'slug' | 'code' | 'sku'> = {
  product_slug_unique: 'slug',
  product_code_unique: 'code',
  variant_sku_unique: 'sku',
};

function conflictField(error: unknown): 'slug' | 'code' | 'sku' | undefined {
  const constraint = violatedConstraint(error, UNIQUE_VIOLATION);
  return constraint ? conflictFieldByConstraint[constraint] : undefined;
}

/** Lets `createProduct` retry a derived slug instead of failing the request. */
export const isSlugConflict = (error: unknown) => conflictField(error) === 'slug';

/** Postgres names the duplicate in `detail`: `Key (sku)=(PAN-28) already exists.` */
function duplicateValue(error: unknown): string | undefined {
  let current = error;
  while (typeof current === 'object' && current !== null) {
    const detail = (current as { detail?: unknown }).detail;
    if (typeof detail === 'string') return /\)=\((.*)\) already exists/.exec(detail)?.[1];
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

/**
 * Maps the write failures a client can cause to responses it can act on:
 * a taken slug/code/SKU is a 409 naming the field (and, for a SKU, which one,
 * since a product has many), and a `categoryId` with no such category is a 422.
 * Relying on the constraints rather than checking first means no race between
 * the check and the write. Anything else is rethrown untouched.
 */
export function rethrowAsClientError(error: unknown): never {
  const field = conflictField(error);
  if (field) {
    const value = field === 'sku' ? duplicateValue(error) : undefined;
    throw new HTTPException(409, {
      res: Response.json({ error: 'conflict', field, value }, { status: 409 }),
    });
  }
  if (violatedConstraint(error, FOREIGN_KEY_VIOLATION) === 'product_category_id_category_id_fk') {
    throw new HTTPException(422, {
      res: Response.json({ error: 'invalid_category', field: 'categoryId' }, { status: 422 }),
    });
  }
  throw error;
}

/**
 * Deleting a product cascades to its variants, and `stock_ledger.variant_id` is
 * `restrict`: stock history is never thrown away. The admin archives it instead.
 */
export function rethrowAsHasStockHistory(error: unknown): never {
  if (
    violatedConstraint(error, FOREIGN_KEY_VIOLATION) === 'stock_ledger_variant_id_variant_id_fk'
  ) {
    throw new HTTPException(409, {
      res: Response.json({ error: 'product_has_stock_history' }, { status: 409 }),
    });
  }
  throw error;
}

/** A variant `id` in the payload that is not a live variant of this product. */
export const unknownVariant = () =>
  new HTTPException(422, {
    res: Response.json({ error: 'unknown_variant', field: 'variants' }, { status: 422 }),
  });
