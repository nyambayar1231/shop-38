import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { HTTPException } from 'hono/http-exception';
import {
  createCustomerSchema,
  customerIdParamSchema,
  updateCustomerSchema,
} from '@shop-38/contracts';
import type { AppEnv } from '../../env.js';
import { rethrowAsConflict, rethrowAsInUse } from './customer.errors.js';
import * as customerService from './customer.service.js';

const notFound = () => new HTTPException(404, { message: 'Customer not found' });

export const customerRoutes = new Hono<AppEnv>()
  .get('/', async (c) => {
    return c.json(await customerService.listCustomers(c.get('db')));
  })
  .get('/:id', zValidator('param', customerIdParamSchema), async (c) => {
    const customer = await customerService.getCustomerById(c.get('db'), c.req.valid('param').id);
    if (!customer) throw notFound();
    return c.json(customer);
  })
  .post('/', zValidator('json', createCustomerSchema), async (c) => {
    const customer = await customerService
      .createCustomer(c.get('db'), c.req.valid('json'))
      .catch(rethrowAsConflict);
    return c.json(customer, 201);
  })
  .patch(
    '/:id',
    zValidator('param', customerIdParamSchema),
    zValidator('json', updateCustomerSchema),
    async (c) => {
      const customer = await customerService
        .updateCustomer(c.get('db'), c.req.valid('param').id, c.req.valid('json'))
        .catch(rethrowAsConflict);
      if (!customer) throw notFound();
      return c.json(customer);
    },
  )
  .delete('/:id', zValidator('param', customerIdParamSchema), async (c) => {
    const customer = await customerService
      .deleteCustomer(c.get('db'), c.req.valid('param').id)
      .catch(rethrowAsInUse);
    if (!customer) throw notFound();
    return c.body(null, 204);
  });
