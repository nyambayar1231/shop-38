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
 * kept for its history. A product that has stock history cannot be deleted, so
 * archiving is how it leaves the catalog.
 */
export const PRODUCT_STATUSES = ['draft', 'active', 'archived'] as const;

export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

/**
 * Why a variant's stock changed. `initial` is written only by the API, when a
 * variant is created with a starting quantity; the rest are what a person picks
 * when adjusting stock by hand. Sales arrive with orders.
 */
export const STOCK_REASONS = [
  'initial',
  'receipt',
  'return',
  'damage',
  'loss',
  'correction',
] as const;

export type StockReason = (typeof STOCK_REASONS)[number];

/** The reasons a manual adjustment may carry. `initial` is the API's alone. */
export const MANUAL_STOCK_REASONS = ['receipt', 'return', 'damage', 'loss', 'correction'] as const;

export type ManualStockReason = (typeof MANUAL_STOCK_REASONS)[number];
