import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { HTTPException } from 'hono/http-exception';
import { createUploadSchema, fileIdParamSchema } from '@shop-38/contracts';
import type { AppEnv } from '../../env.js';
import { createStorage } from '../../lib/storage.js';
import * as fileService from './file.service.js';

/**
 * Upload flow. The API never receives file bytes:
 *   1. POST /files               -> a `pending` row, plus a presigned S3 PUT URL
 *   2. client PUTs the file to that URL, straight to S3
 *   3. POST /files/:id/complete  -> checks the object in S3, then marks the row `uploaded`
 */
export const fileRoutes = new Hono<AppEnv>()
  .post('/', zValidator('json', createUploadSchema), async (c) => {
    const result = await fileService.createUpload(
      c.get('db'),
      createStorage(c.env),
      c.req.valid('json'),
    );
    return c.json(result, 201);
  })
  .post('/:id/complete', zValidator('param', fileIdParamSchema), async (c) => {
    const { id } = c.req.valid('param');
    const file = await fileService.completeUpload(c.get('db'), createStorage(c.env), id);
    if (!file) throw new HTTPException(404, { message: 'File not found' });
    return c.json(file);
  })
  .get('/:id', zValidator('param', fileIdParamSchema), async (c) => {
    const { id } = c.req.valid('param');
    const file = await fileService.getFileById(c.get('db'), id);
    if (!file) throw new HTTPException(404, { message: 'File not found' });
    return c.json(file);
  });
