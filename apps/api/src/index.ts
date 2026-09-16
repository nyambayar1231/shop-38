import { Hono } from 'hono';
import { CATEGORIES } from '@shop-38/contracts';

const app = new Hono();

app.get('/', (c) => {
  console.log(CATEGORIES);
  return c.text('Hello Hono!');
});

app.get('/health', (c) => {
  return c.text('Healthy deployments!!!');
});

export default app;
