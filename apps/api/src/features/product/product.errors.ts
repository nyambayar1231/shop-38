import { HTTPException } from 'hono/http-exception';
import {
  FOREIGN_KEY_VIOLATION,
  UNIQUE_VIOLATION,
  violatedConstraint,
} from '../../lib/postgres-errors.js';

/** The `product` table is unique on `slug` and on `code`. */
const conflictFieldByConstraint: Record<string, 'slug' | 'code'> = {
  product_slug_unique: 'slug',
  product_code_unique: 'code',
};

function conflictField(error: unknown): 'slug' | 'code' | undefined {
  const constraint = violatedConstraint(error, UNIQUE_VIOLATION);
  return constraint ? conflictFieldByConstraint[constraint] : undefined;
}

/** Lets `createProduct` retry a derived slug instead of failing the request. */
export const isSlugConflict = (error: unknown) => conflictField(error) === 'slug';

/**
 * Maps the write failures a client can cause to responses it can act on:
 * a taken slug/code is a 409 naming the field, and a `categoryId` with no such
 * category is a 422. Relying on the constraints rather than checking first means
 * no race between the check and the write. Anything else is rethrown untouched.
 */
export function rethrowAsClientError(error: unknown): never {
  const field = conflictField(error);
  if (field) {
    throw new HTTPException(409, {
      res: Response.json({ error: 'conflict', field }, { status: 409 }),
    });
  }
  if (violatedConstraint(error, FOREIGN_KEY_VIOLATION) === 'product_category_id_category_id_fk') {
    throw new HTTPException(422, {
      res: Response.json({ error: 'invalid_category', field: 'categoryId' }, { status: 422 }),
    });
  }
  throw error;
}
