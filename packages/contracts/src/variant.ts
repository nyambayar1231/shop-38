import { z } from 'zod';

export const variantIdParamSchema = z.object({
  id: z.uuid(),
});
