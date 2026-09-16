import { Hono } from 'hono';
import { CATEGORIES } from '@shop-38/contracts';
import { schema } from '@shop-38/db';

const app = new Hono();

app.get('/', (c) => {
  console.log(CATEGORIES);
  return c.text('Hello Hono!');
});

app.get('/health', (c) => {
  return c.text('Healthy deployments!!!');
});

export default app;
