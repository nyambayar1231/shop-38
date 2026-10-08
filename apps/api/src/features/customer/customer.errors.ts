import { HTTPException } from 'hono/http-exception';
import {
  FOREIGN_KEY_VIOLATION,
  UNIQUE_VIOLATION,
  violatedConstraint,
} from '../../lib/postgres-errors.js';

/** The `customer` table is unique on `phone`, and on `email` when set. */
const conflictFieldByConstraint: Record<string, 'phone' | 'email'> = {
  customer_phone_unique: 'phone',
  customer_email_unique: 'email',
};

/**
 * Turns a taken phone/email into a 409 naming the field, so the form can mark the
 * right input. Relying on the constraint rather than checking first means no race.
 * Anything else is rethrown untouched.
 */
export function rethrowAsConflict(error: unknown): never {
  const constraint = violatedConstraint(error, UNIQUE_VIOLATION);
  const field = constraint ? conflictFieldByConstraint[constraint] : undefined;
  if (field) {
    throw new HTTPException(409, {
      res: Response.json({ error: 'conflict', field }, { status: 409 }),
    });
  }
  throw error;
}

/** `order.customer_id` is `on delete restrict`: a customer with orders cannot go. */
export function rethrowAsInUse(error: unknown): never {
  if (violatedConstraint(error, FOREIGN_KEY_VIOLATION) === 'order_customer_id_customer_id_fk') {
    throw new HTTPException(409, {
      res: Response.json({ error: 'customer_has_orders' }, { status: 409 }),
    });
  }
  throw error;
}
