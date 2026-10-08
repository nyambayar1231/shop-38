import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { HTTPException } from 'hono/http-exception';
import {
  createOrderSchema,
  listOrdersQuerySchema,
  orderIdParamSchema,
  updateOrderStatusSchema,
} from '@shop-38/contracts';
import type { AppEnv } from '../../env.js';
import { orderNotPending } from './order.errors.js';
import * as orderService from './order.service.js';

const notFound = () => new HTTPException(404, { message: 'Order not found' });

/** No delete and no editing of lines: an order is a record. Cancel it instead. */
export const orderRoutes = new Hono<AppEnv>()
  .get('/', zValidator('query', listOrdersQuerySchema), async (c) => {
    return c.json(await orderService.listOrders(c.get('db'), c.req.valid('query')));
  })
  .get('/:id', zValidator('param', orderIdParamSchema), async (c) => {
    const order = await orderService.getOrderById(c.get('db'), c.req.valid('param').id);
    if (!order) throw notFound();
    return c.json(order);
  })
  .post('/', zValidator('json', createOrderSchema), async (c) => {
    const order = await orderService.createOrder(c.get('db'), c.req.valid('json'));
    return c.json(order, 201);
  })
  .patch(
    '/:id/status',
    zValidator('param', orderIdParamSchema),
    zValidator('json', updateOrderStatusSchema),
    async (c) => {
      const result = await orderService.updateOrderStatus(
        c.get('db'),
        c.req.valid('param').id,
        c.req.valid('json'),
      );
      if (result === 'not_found') throw notFound();
      if (result === 'not_pending') throw orderNotPending();
      return c.json(result);
    },
  );
