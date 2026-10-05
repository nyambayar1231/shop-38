import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { HTTPException } from 'hono/http-exception';
import {
  changeVariantPriceSchema,
  createStockMovementSchema,
  listVariantsQuerySchema,
  variantIdParamSchema,
} from '@shop-38/contracts';
import type { AppEnv } from '../../env.js';
import * as variantService from './variant.service.js';

const notFound = () => new HTTPException(404, { message: 'Variant not found' });

/**
 * Variants are created and edited through their product (`PUT /products/:id/variants`).
 * These routes are about what happens to a variant afterwards: its stock and its prices.
 */
export const variantRoutes = new Hono<AppEnv>()
  .get('/', zValidator('query', listVariantsQuerySchema), async (c) => {
    return c.json(await variantService.listVariants(c.get('db'), c.req.valid('query')));
  })
  .get('/:id', zValidator('param', variantIdParamSchema), async (c) => {
    const variant = await variantService.getVariantById(c.get('db'), c.req.valid('param').id);
    if (!variant) throw notFound();
    return c.json(variant);
  })
  .get('/:id/stock-movements', zValidator('param', variantIdParamSchema), async (c) => {
    const { id } = c.req.valid('param');
    if (!(await variantService.variantExists(c.get('db'), id))) throw notFound();
    return c.json(await variantService.listStockMovements(c.get('db'), id));
  })
  .post(
    '/:id/stock-movements',
    zValidator('param', variantIdParamSchema),
    zValidator('json', createStockMovementSchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const result = await variantService.createStockMovement(c.get('db'), id, c.req.valid('json'));
      if (!result) throw notFound();
      return c.json(result, 201);
    },
  )
  .get('/:id/prices', zValidator('param', variantIdParamSchema), async (c) => {
    const { id } = c.req.valid('param');
    if (!(await variantService.variantExists(c.get('db'), id))) throw notFound();
    return c.json(await variantService.listPrices(c.get('db'), id));
  })
  .post(
    '/:id/prices',
    zValidator('param', variantIdParamSchema),
    zValidator('json', changeVariantPriceSchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const price = await variantService.changeVariantPrice(c.get('db'), id, c.req.valid('json'));
      if (!price) throw notFound();
      return c.json(price, 201);
    },
  );
