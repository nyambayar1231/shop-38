import { desc, eq, getTableColumns, sql } from 'drizzle-orm';
import { schema } from '@shop-38/db';
import type { Database } from '@shop-38/db';
import type { CreateCustomerInput, UpdateCustomerInput } from '@shop-38/contracts';

/** Newest first, each with how many orders it has, for the admin list and the order form's picker. */
export const listCustomers = (db: Database) =>
  db
    .select({
      ...getTableColumns(schema.customer),
      orderCount: sql<number>`count(${schema.order.id})::int`,
    })
    .from(schema.customer)
    .leftJoin(schema.order, eq(schema.order.customerId, schema.customer.id))
    .groupBy(schema.customer.id)
    .orderBy(desc(schema.customer.createdAt));

export const getCustomerById = async (db: Database, id: string) => {
  const [row] = await db.select().from(schema.customer).where(eq(schema.customer.id, id));
  return row;
};

export const createCustomer = async (db: Database, input: CreateCustomerInput) => {
  const [row] = await db.insert(schema.customer).values(input).returning();
  return row!;
};

export const updateCustomer = async (db: Database, id: string, input: UpdateCustomerInput) => {
  // `updateCustomerSchema` is fully partial, so an edit that changed nothing is a
  // valid `{}` — which drizzle would reject as "No values to set".
  if (Object.keys(input).length === 0) return getCustomerById(db, id);
  const [row] = await db
    .update(schema.customer)
    .set(input)
    .where(eq(schema.customer.id, id))
    .returning();
  return row;
};

/** Fails on `order_customer_id_customer_id_fk` if the customer has orders. */
export const deleteCustomer = async (db: Database, id: string) => {
  const [row] = await db
    .delete(schema.customer)
    .where(eq(schema.customer.id, id))
    .returning({ id: schema.customer.id });
  return row;
};
