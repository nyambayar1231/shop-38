import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { HTTPException } from 'hono/http-exception';
import {
  createProductSchema,
  updateProductSchema,
  productIdParamSchema,
  listProductsQuerySchema,
} from '@shop-38/contracts';
import type { AppEnv } from '../../env.js';
import { rethrowAsClientError } from './product.errors.js';
import * as productService from './product.service.js';

export const productRoutes = new Hono<AppEnv>()
  .get('/', zValidator('query', listProductsQuerySchema), async (c) => {
    const products = await productService.listProducts(c.get('db'), c.req.valid('query'));
    return c.json(products);
  })
  .get('/:id', zValidator('param', productIdParamSchema), async (c) => {
    const { id } = c.req.valid('param');
    const product = await productService.getProductById(c.get('db'), id);
    if (!product) throw new HTTPException(404, { message: 'Product not found' });
    return c.json(product);
  })
  .post('/', zValidator('json', createProductSchema), async (c) => {
    const product = await productService
      .createProduct(c.get('db'), c.req.valid('json'))
      .catch(rethrowAsClientError);
    return c.json(product, 201);
  })
  .patch(
    '/:id',
    zValidator('param', productIdParamSchema),
    zValidator('json', updateProductSchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const product = await productService
        .updateProduct(c.get('db'), id, c.req.valid('json'))
        .catch(rethrowAsClientError);
      if (!product) throw new HTTPException(404, { message: 'Product not found' });
      return c.json(product);
    },
  )
  .delete('/:id', zValidator('param', productIdParamSchema), async (c) => {
    const { id } = c.req.valid('param');
    const product = await productService.deleteProduct(c.get('db'), id);
    if (!product) throw new HTTPException(404, { message: 'Product not found' });
    return c.body(null, 204);
  });
