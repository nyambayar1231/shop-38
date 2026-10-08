import { HTTPException } from 'hono/http-exception';

/**
 * Variants in the payload that cannot be sold right now: archived, deleted,
 * never priced, or part of an archived product. Named, so the admin can point
 * at the lines.
 */
export const unavailableVariants = (variantIds: string[]) =>
  new HTTPException(422, {
    res: Response.json(
      { error: 'unavailable_variant', field: 'items', variantIds },
      { status: 422 },
    ),
  });

/** A `customerId` with no such customer — deleted after the form loaded its list. */
export const unknownCustomer = () =>
  new HTTPException(422, {
    res: Response.json({ error: 'unknown_customer', field: 'customerId' }, { status: 422 }),
  });

/** A status change on an order that is already completed or cancelled. */
export const orderNotPending = () =>
  new HTTPException(409, {
    res: Response.json({ error: 'not_pending', field: 'status' }, { status: 409 }),
  });
