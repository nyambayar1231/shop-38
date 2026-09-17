import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { HTTPException } from 'hono/http-exception';
import {
  categoryIdParamSchema,
  createCategorySchema,
  updateCategorySchema,
} from './category.schema.js';
import * as categoryService from './category.service.js';

export const categoryRoutes = new Hono()
  .get('/', async (c) => {
    const categories = await categoryService.listCategories();
    return c.json(categories);
  })
  .get('/:id', zValidator('param', categoryIdParamSchema), async (c) => {
    const { id } = c.req.valid('param');
    const category = await categoryService.getCategoryById(id);
    if (!category) throw new HTTPException(404, { message: 'Category not found' });
    return c.json(category);
  })
  .post('/', zValidator('json', createCategorySchema), async (c) => {
    const input = c.req.valid('json');
    const category = await categoryService.createCategory(input);
    return c.json(category, 201);
  })
  .patch(
    '/:id',
    zValidator('param', categoryIdParamSchema),
    zValidator('json', updateCategorySchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const input = c.req.valid('json');
      const category = await categoryService.updateCategory(id, input);
      if (!category) throw new HTTPException(404, { message: 'Category not found' });
      return c.json(category);
    },
  )
  .delete('/:id', zValidator('param', categoryIdParamSchema), async (c) => {
    const { id } = c.req.valid('param');
    const category = await categoryService.deleteCategory(id);
    if (!category) throw new HTTPException(404, { message: 'Category not found' });
    return c.body(null, 204);
  });
