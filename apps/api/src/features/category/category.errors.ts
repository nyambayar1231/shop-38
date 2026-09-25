import { HTTPException } from 'hono/http-exception';
import {
  FOREIGN_KEY_VIOLATION,
  UNIQUE_VIOLATION,
  violatedConstraint,
} from '../../lib/postgres-errors.js';

/** The `category` table is unique on `name` and on `slug`. */
const conflictFieldByConstraint: Record<string, 'name' | 'slug'> = {
  category_name_unique: 'name',
  category_slug_unique: 'slug',
};

/** Which unique column this error is about, if it is a unique violation at all. */
function conflictField(error: unknown): 'name' | 'slug' | undefined {
  const constraint = violatedConstraint(error, UNIQUE_VIOLATION);
  return constraint ? conflictFieldByConstraint[constraint] : undefined;
}

/** Lets `createCategory` retry a derived slug instead of failing the request. */
export const isSlugConflict = (error: unknown) => conflictField(error) === 'slug';

/**
 * Turns a duplicate name/slug into a 409 naming the offending field, so an edit
 * form can mark the right input instead of showing "Internal Server Error".
 * Anything else is rethrown untouched.
 */
export function rethrowAsConflict(error: unknown): never {
  const field = conflictField(error);
  if (field) {
    throw new HTTPException(409, {
      res: Response.json({ error: 'conflict', field }, { status: 409 }),
    });
  }
  throw error;
}

/**
 * `product.category_id` is `on delete restrict`: a category that still has
 * products cannot go. That is a 409 the admin can explain, not a 500.
 */
export function rethrowAsInUse(error: unknown): never {
  if (violatedConstraint(error, FOREIGN_KEY_VIOLATION) === 'product_category_id_category_id_fk') {
    throw new HTTPException(409, {
      res: Response.json({ error: 'category_in_use' }, { status: 409 }),
    });
  }
  throw error;
}
