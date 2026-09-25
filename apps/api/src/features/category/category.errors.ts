import { HTTPException } from 'hono/http-exception';

/** postgres `unique_violation`. The `category` table is unique on `name` and on `slug`. */
const UNIQUE_VIOLATION = '23505';

const conflictFieldByConstraint: Record<string, 'name' | 'slug'> = {
  category_name_unique: 'name',
  category_slug_unique: 'slug',
};

type PostgresErrorShape = { code?: unknown; constraint_name?: unknown };

/**
 * drizzle wraps driver failures in a `DrizzleQueryError`, so the `PostgresError`
 * carrying the constraint name sits somewhere down the `cause` chain.
 */
function findPostgresError(error: unknown): PostgresErrorShape | undefined {
  let current = error;
  while (typeof current === 'object' && current !== null) {
    if ('code' in current && 'constraint_name' in current) return current as PostgresErrorShape;
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

/** Which unique column this error is about, if it is a unique violation at all. */
function conflictField(error: unknown): 'name' | 'slug' | undefined {
  const pgError = findPostgresError(error);
  if (pgError?.code !== UNIQUE_VIOLATION) return undefined;
  return conflictFieldByConstraint[String(pgError.constraint_name)];
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
