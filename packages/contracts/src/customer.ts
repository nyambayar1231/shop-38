import { z } from 'zod';

// ---------------------------------------------------------------------------
// Customers: the shoppers orders are placed for. Staff create them in the
// admin; there is no shopper sign-in yet, so a customer has no password.
// ---------------------------------------------------------------------------

/**
 * Spaces, dashes and brackets are dropped, so `9911-2233` and `9911 2233` are the
 * same number and the uniqueness rule can catch it. A leading `+` is kept.
 */
export const phoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s\-()]/g, ''))
  .pipe(z.string().regex(/^\+?\d{6,15}$/, 'invalid_phone'));

export const createCustomerSchema = z
  .object({
    name: z.string().trim().min(1).max(150),
    /** How staff reach the customer, and how they find them again. Unique across customers. */
    phone: phoneSchema,
    /** Unique when present. */
    email: z.string().trim().toLowerCase().pipe(z.email().max(254)).nullish(),
    /** Where orders are delivered. */
    address: z.string().trim().max(500).nullish(),
    note: z.string().trim().max(1000).nullish(),
  })
  .strict();

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

/**
 * Every field optional, but `.strict()` so a typo'd key is a 400 rather than a
 * silently ignored no-op — the worst possible outcome for an edit form.
 */
export const updateCustomerSchema = createCustomerSchema.partial().strict();

export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

export const customerIdParamSchema = z.object({
  id: z.uuid(),
});
