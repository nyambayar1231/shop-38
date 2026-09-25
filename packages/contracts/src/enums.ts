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
