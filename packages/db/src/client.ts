import postgres from 'postgres';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from './schema/index.js';

export type Database = PostgresJsDatabase<typeof schema>;

export function createDb(connectionString: string): Database {
  const client = postgres(connectionString);
  return drizzle(client, { schema });
}

/** The handle inside `db.transaction(...)`. Take it, not `Database`, where a step must not run outside one. */
export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

/** Either one: for a helper that works both inside and outside a transaction. */
export type Executor = Database | Tx;
