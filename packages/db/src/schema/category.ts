import { pgEnum } from 'drizzle-orm/pg-core';
import { CATEGORIES } from '@shop-38/contracts';

export const categoryEnum = pgEnum('category', CATEGORIES);
