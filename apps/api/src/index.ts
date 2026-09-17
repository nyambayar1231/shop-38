import { Hono } from 'hono';
import { categoryRoutes } from './features/category/category.routes.js';

const app = new Hono();

app.get('/health', (c) => {
  return c.text('Healthy deployments!!!');
});

app.route('/categories', categoryRoutes);

export default app;
