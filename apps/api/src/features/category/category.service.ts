import { eq } from 'drizzle-orm';
import { schema } from '@shop-38/db';
import type { Database } from '@shop-38/db';
import type { CreateCategoryInput, UpdateCategoryInput } from './category.schema.js';

export const listCategories = (db: Database) => db.select().from(schema.category);

export const getCategoryById = async (db: Database, id: string) => {
  const [row] = await db.select().from(schema.category).where(eq(schema.category.id, id));
  return row;
};

export const createCategory = async (db: Database, input: CreateCategoryInput) => {
  const [row] = await db.insert(schema.category).values(input).returning();
  return row;
};

export const updateCategory = async (db: Database, id: string, input: UpdateCategoryInput) => {
  const [row] = await db
    .update(schema.category)
    .set(input)
    .where(eq(schema.category.id, id))
    .returning();
  return row;
};

export const deleteCategory = async (db: Database, id: string) => {
  const [row] = await db.delete(schema.category).where(eq(schema.category.id, id)).returning();
  return row;
};
