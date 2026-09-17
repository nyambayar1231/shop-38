import postgres from 'postgres';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from './schema/index.js';

export type Database = PostgresJsDatabase<typeof schema>;

export function createDb(connectionString: string): Database {
  const client = postgres(connectionString);
  return drizzle(client, { schema });
}
