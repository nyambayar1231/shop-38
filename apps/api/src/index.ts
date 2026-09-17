import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createDb } from '@shop-38/db';
import type { AppEnv } from './env.js';
import { categoryRoutes } from './features/category/category.routes.js';

const app = new Hono<AppEnv>()
  .use('*', cors())
  .use('*', async (c, next) => {
    c.set('db', createDb(c.env.HYPERDRIVE.connectionString));
    await next();
  })
  .get('/health', (c) => {
    return c.text('Healthy deployments!!!');
  })
  .route('/categories', categoryRoutes);

export type AppType = typeof app;
export default app;
