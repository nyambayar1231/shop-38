export const UNIQUE_VIOLATION = '23505';
export const FOREIGN_KEY_VIOLATION = '23503';

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

/** The constraint `error` violated, if it is a postgres error with the given SQLSTATE. */
export function violatedConstraint(error: unknown, sqlState: string): string | undefined {
  const pgError = findPostgresError(error);
  if (pgError?.code !== sqlState) return undefined;
  return String(pgError.constraint_name);
}
