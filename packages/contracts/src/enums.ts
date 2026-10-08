/**
 * Shared vocabularies. packages/db builds its pgEnums from these arrays,
 * so the database and the type system cannot drift apart.
 */

export const CATEGORY_STATUSES = ['active', 'inactive'] as const;

export type CategoryStatus = (typeof CATEGORY_STATUSES)[number];

/**
 * `pending` once an upload URL has been handed out, `uploaded` once S3 confirms
 * the object is really there. A row stuck in `pending` is an abandoned upload.
 */
export const FILE_STATUSES = ['pending', 'uploaded'] as const;

export type FileStatus = (typeof FILE_STATUSES)[number];

/**
 * `draft` is being prepared and never shown to shoppers, `archived` is retired but
 * kept for its history.
 */
export const PRODUCT_STATUSES = ['draft', 'active', 'archived'] as const;

export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

/**
 * An order starts `pending` and ends `completed` or `cancelled`. Both of those
 * are final: an order is a record of what happened, not a draft.
 */
export const ORDER_STATUSES = ['pending', 'completed', 'cancelled'] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];
