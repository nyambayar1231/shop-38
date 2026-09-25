import { z } from 'zod';
import { CATEGORY_STATUSES } from './enums.js';
import { slugSchema } from './slug.js';

export const createCategorySchema = z.object({
  /**
   * Omit it and the API derives one from `name`, de-duplicating with a numeric
   * suffix. Pass one only to claim a specific URL — then a collision is a 409
   * rather than something silently renamed.
   */
  slug: slugSchema.optional(),
  name: z.string().min(1).max(150),
  description: z.string().max(300).nullish(),
  status: z.enum(CATEGORY_STATUSES),
  /** A file from POST /files that has completed its upload. `null` removes the image. */
  imageFileId: z.uuid().nullish(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

/**
 * Every field optional, but `.strict()` so a typo'd key is a 400 rather than a
 * silently ignored no-op — the worst possible outcome for an edit form.
 */
export const updateCategorySchema = createCategorySchema.partial().strict();

export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

export const categoryIdParamSchema = z.object({
  id: z.uuid(),
});
