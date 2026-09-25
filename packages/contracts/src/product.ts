import { z } from 'zod';
import { slugSchema } from './slug.js';

export const createProductSchema = z.object({
  /**
   * Omit it and the API derives one from `name`, de-duplicating with a numeric
   * suffix. Pass one only to claim a specific URL — then a collision is a 409
   * rather than something silently renamed.
   */
  slug: slugSchema.optional(),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).nullish(),
  /** The shop's own product code (SKU). Unique when present. */
  code: z.string().trim().min(1).max(64).nullish(),
  categoryId: z.uuid(),
  /** A file from POST /files that has completed its upload. `null` removes the image. */
  imageFileId: z.uuid().nullish(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

/**
 * Every field optional, but `.strict()` so a typo'd key is a 400 rather than a
 * silently ignored no-op — the worst possible outcome for an edit form.
 */
export const updateProductSchema = createProductSchema.partial().strict();

export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const productIdParamSchema = z.object({
  id: z.uuid(),
});

export const listProductsQuerySchema = z.object({
  categoryId: z.uuid().optional(),
});
