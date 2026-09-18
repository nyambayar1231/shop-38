/**
 * Shared vocabularies. packages/db builds its pgEnums from these arrays,
 * so the database and the type system cannot drift apart.
 */

export const CATEGORY_STATUSES = ['active', 'inactive'] as const;

export type CategoryStatus = (typeof CATEGORY_STATUSES)[number];
